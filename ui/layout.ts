// src/features/jobs/layout-from-run-json.ts
import type { Node, Edge } from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";

/** ====== Types min nécessaires (compatibles avec ton layout ELK) ====== */
export type TaskType = "task" | "flow";
export type ExecutionState = string;

export type Task = {
    task_id: string;
    task_type: TaskType;
    state?: ExecutionState;
    dependencies?: string[];
    subflow_execution?: Job;
    // payload libre si tu veux l'exploiter côté UI
    [k: string]: any;
};

export type Job = {
    run_id: string;
    flow_name?: string;
    task_executions: Record<string, Task>;
};

/** Ton format JSON (simplifié aux champs qu’on utilise ici) */
export type RunJson = {
    run_id: string;
    flow_name: string;
    tasks: Array<{
        id: string;
        task_id: string;
        task_type: "task" | "flow" | string;
        state: string;
    }>;
    dependencies?: Array<{
        source: string;
        target: string;
    }>;
};

/** ====== Ton layout ELK (avec centrage jonctions & “follow predecessor”) ====== */

export type TaskExecutionNode = Node<Task>;
export type TaskEdge = Edge<Task>;

type ElkNode = {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    children?: ElkNode[];
    edges?: ElkEdge[];
    layoutOptions?: Record<string, string>;
};
type ElkEdge = { id: string; sources: string[]; targets: string[] };

const elk = new ELK();

const DEFAULT_LEAF = { width: 260, height: 36 };
const DEFAULT_GROUP = { width: 120, height: 80 };

type LayoutOpts = {
    algorithm?: "layered" | "mrtree" | "force";
    direction?: "DOWN" | "RIGHT" | "UP" | "LEFT";
    spacing?: number;
    padding?: number;
};

/** ========= 1) Adaptateur: RunJson -> Job (avec groupes & deps) ========= */

export function toJobFromRun(run: RunJson): Job {
    // 1) créer les feuilles depuis run.tasks
    const leaves = new Map<string, Task>();
    for (const t of run.tasks ?? []) {
        leaves.set(t.task_id, {
            task_id: t.task_id,
            task_type: t.task_type === "flow" ? "flow" : "task",
            state: t.state,
            dependencies: [],
        });
    }

    // 2) injecter deps + créer nœuds synthétiques si absents (ex: send_notification)
    for (const d of run.dependencies ?? []) {
        if (!leaves.has(d.source)) {
            leaves.set(d.source, {
                task_id: d.source,
                task_type: "task",
                state: "scheduled",
                dependencies: [],
                synthetic: true,
            });
        }
        if (!leaves.has(d.target)) {
            leaves.set(d.target, {
                task_id: d.target,
                task_type: "task",
                state: "scheduled",
                dependencies: [],
                synthetic: true,
            });
        }
        // attacher la dépendance: source -> target
        leaves.get(d.target)!.dependencies!.push(d.source);
    }

    // 3) regrouper par préfixe de type "<xxx>_flow" (ex: hpl_flow, ftb_flow)
    const groupRegex = /^([a-zA-Z0-9]+_flow)/;
    const groups = new Map<string, Task[]>();
    const rootLeaves: Task[] = [];

    for (const t of leaves.values()) {
        const m = groupRegex.exec(t.task_id);
        if (m) {
            const gid = m[1]; // ex: "hpl_flow" ou "ftb_flow"
            if (!groups.has(gid)) groups.set(gid, []);
            groups.get(gid)!.push(t);
        } else {
            rootLeaves.push(t);
        }
    }

    // 4) construire le Job racine: chaque groupe devient un task "flow" avec subflow
    const task_executions: Record<string, Task> = {};

    // groupes
    for (const [gid, members] of groups) {
        // subflow: ne contient que ses membres directs (feuilles)
        const subflow: Job = {
            run_id: run.run_id,
            flow_name: gid,
            task_executions: Object.fromEntries(
                members.map((m) => [m.task_id, m])
            ),
        };

        // tâche flow conteneur
        task_executions[gid] = {
            task_id: gid,
            task_type: "flow",
            state: "scheduled",
            dependencies: [], // dépendances éventuelles vers/depuis le groupe seront portées par les cibles/feuilles
            subflow_execution: subflow,
        };
    }

    // feuilles non mappées dans un groupe (ex: send_notification)
    for (const lf of rootLeaves) {
        task_executions[lf.task_id] = lf;
    }

    // 5) IMPORTANT: si une dépendance cible un “nom de groupe” (ex: ftb_flow -> send_notification),
    // les dépendances ont été attachées au target (send_notification). C’est OK:
    // on ne déplace PAS ces deps vers le conteneur; ELK routira depuis les feuilles → target via le groupe.

    return {
        run_id: run.run_id,
        flow_name: run.flow_name,
        task_executions,
    };
}

/** ========= 2) Layout ELK (avec centrage “jonctions” & “follow predecessor”) ========= */

export async function layoutFromRunJson(
    run: RunJson,
    opts?: LayoutOpts
): Promise<{ nodes: TaskExecutionNode[]; edges: TaskEdge[] }> {
    const job = toJobFromRun(run);
    return createElkLayout(job, opts);
}

export async function createElkLayout(
    job: Job,
    opts?: LayoutOpts
): Promise<{ nodes: TaskExecutionNode[]; edges: TaskEdge[] }> {
    const algorithm = opts?.algorithm ?? "layered";
    const direction = opts?.direction ?? "RIGHT";
    const spacing = String(opts?.spacing ?? 32);
    const padding = String(opts?.padding ?? 16);

    const taskIndex = new Map<string, { task: Task; runId: string }>();
    const children = buildElkChildren(job, taskIndex);

    // tri optionnel (ftb_* avant hpl_*)
    children.sort((a, b) => {
        const aw = a.id.startsWith("ftb_") ? 0 : a.id.startsWith("hpl_") ? 1 : 2;
        const bw = b.id.startsWith("ftb_") ? 0 : b.id.startsWith("hpl_") ? 1 : 2;
        return aw - bw || a.id.localeCompare(b.id);
    });

    const elkGraph: ElkNode = {
        id: "root",
        layoutOptions: {
            "elk.algorithm": algorithm,
            "elk.direction": direction,
            "elk.edgeRouting": "ORTHOGONAL",
            "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
            "elk.layered.considerModelOrder": "NODES",
            "elk.layered.thoroughness": "100",
            "elk.layered.compaction.postCompaction.enabled": "true",
            "elk.layered.spacing.nodeNodeBetweenLayers": spacing,
            "elk.hierarchyHandling": "INCLUDE_CHILDREN",
            "elk.spacing.nodeNode": spacing,
            "elk.spacing.edgeNode": "24",
            "elk.spacing.edgeEdge": "16",
            "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
            "elk.padding": padding,
        },
        children,
        edges: buildElkEdgesFromJob(job),
    };

    const layout = (await elk.layout(elkGraph)) as ElkNode;

    // — Post: aligner les cibles par rapport à leurs prédécesseurs (1 ou N) —
    const allElkEdges = buildElkEdgesFromJob(job);
    const predsByTarget = indexPredsByTarget(allElkEdges);

    const parentById = new Map<string, ElkNode>();
    const abs = new Map<string, { ax: number; ay: number; w: number; h: number; parent?: ElkNode }>();
    collectAbs(layout, 0, 0, parentById, abs);
    centerTargetsBetweenPredecessors(layout, predsByTarget, parentById, abs);

    // flatten → React Flow
    const nodes: TaskExecutionNode[] = [];
    flattenToReactFlowNodes(layout, taskIndex, undefined, nodes);
    const edges: TaskEdge[] = buildRfEdgesFromIndex(taskIndex);
    return { nodes, edges };
}

/* ---------------------------- helpers ELK ---------------------------- */

function buildElkChildren(
    job: Job,
    taskIndex: Map<string, { task: Task; runId: string }>
): ElkNode[] {
    const out: ElkNode[] = [];
    const tasks = Object.values(job.task_executions ?? {});

    for (const t of tasks) {
        taskIndex.set(t.task_id, { task: t, runId: job.run_id });

        if (t.task_type === "flow" && t.subflow_execution) {
            out.push({
                id: t.task_id,
                width: DEFAULT_GROUP.width,
                height: DEFAULT_GROUP.height,
                layoutOptions: {
                    "elk.direction": "RIGHT",
                    "elk.spacing.nodeNode": "100",
                    "elk.layered.considerModelOrder": "NODES",
                    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
                    "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
                    "elk.edgeRouting": "ORTHOGONAL",
                    "elk.layered.spacing.nodeNodeBetweenLayers": "100",
                },
                children: buildElkChildren(t.subflow_execution, taskIndex),
            });
        } else {
            out.push({
                id: t.task_id,
                width: DEFAULT_LEAF.width,
                height: DEFAULT_LEAF.height,
                layoutOptions: {
                    "elk.direction": "RIGHT",
                    "elk.edgeRouting": "ORTHOGONAL",
                },
            });
        }
    }
    return out;
}

function buildElkEdgesFromJob(job: Job): ElkEdge[] {
    const edges: ElkEdge[] = [];
    const stack: Job[] = [job];
    while (stack.length) {
        const j = stack.pop()!;
        for (const t of Object.values(j.task_executions ?? {})) {
            for (const dep of t.dependencies ?? []) {
                edges.push({ id: `${dep}__to__${t.task_id}`, sources: [dep], targets: [t.task_id] });
            }
            if (t.task_type === "flow" && t.subflow_execution) stack.push(t.subflow_execution);
        }
    }
    // uniq
    const uniq = new Map<string, ElkEdge>();
    for (const e of edges) if (!uniq.has(e.id)) uniq.set(e.id, e);
    return Array.from(uniq.values());
}

function flattenToReactFlowNodes(
    elkNode: ElkNode,
    taskIndex: Map<string, { task: Task; runId: string }>,
    parentId: string | undefined,
    acc: TaskExecutionNode[]
) {
    if (!elkNode.children) return;
    for (const c of elkNode.children) {
        const info = taskIndex.get(c.id);
        const isGroup = !!(c.children && c.children.length);
        const width = c.width ?? (isGroup ? DEFAULT_GROUP.width : DEFAULT_LEAF.width);
        const height = c.height ?? (isGroup ? DEFAULT_GROUP.height : DEFAULT_LEAF.height);

        acc.push({
            id: c.id,
            position: { x: c.x ?? 0, y: c.y ?? 0 },
            data: info ? { label: info.task.task_id, ...info.task, run_id: info.runId } : { label: c.id },
            parentId,
            extent: parentId ? "parent" : undefined,
            style: { width, height },
            sourcePosition: "right",
            targetPosition: "left",
        });

        if (isGroup) flattenToReactFlowNodes(c, taskIndex, c.id, acc);
    }
}

function buildRfEdgesFromIndex(
    taskIndex: Map<string, { task: Task; runId: string }>
): TaskEdge[] {
    const edges: TaskEdge[] = [];
    for (const { task } of taskIndex.values()) {
        for (const dep of task.dependencies ?? []) {
            const id = `${task.task_id}-${dep}`;
            edges.push({
                id,
                source: dep,
                target: task.task_id,
                type: "smoothstep",
                animated: true,
                data: task,
            });
        }
    }
    const uniq = new Map<string, TaskEdge>();
    for (const e of edges) if (!uniq.has(e.id)) uniq.set(e.id, e);
    return Array.from(uniq.values());
}

/* ----------- centrage (1 prédécesseur = follow, ≥2 = milieu) ----------- */

function indexPredsByTarget(all: ElkEdge[]): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const e of all) {
        const src = e.sources?.[0];
        const tgt = e.targets?.[0];
        if (!src || !tgt) continue;
        if (!map.has(tgt)) map.set(tgt, []);
        map.get(tgt)!.push(src);
    }
    return map;
}

function collectAbs(
    node: ElkNode,
    ox: number,
    oy: number,
    parentById: Map<string, ElkNode>,
    abs: Map<string, { ax: number; ay: number; w: number; h: number; parent?: ElkNode }>
) {
    for (const c of node.children ?? []) {
        const ax = (c.x ?? 0) + ox;
        const ay = (c.y ?? 0) + oy;
        const w = c.width ?? (c.children?.length ? DEFAULT_GROUP.width : DEFAULT_LEAF.width);
        const h = c.height ?? (c.children?.length ? DEFAULT_GROUP.height : DEFAULT_LEAF.height);
        abs.set(c.id, { ax, ay, w, h, parent: node });
        parentById.set(c.id, node);
        if (c.children?.length) collectAbs(c, ax, ay, parentById, abs);
    }
}

/** 2 passes pour stabiliser les chaînes A->B->C */
function centerTargetsBetweenPredecessors(
    root: ElkNode,
    predsByTarget: Map<string, string[]>,
    parentById: Map<string, ElkNode>,
    abs: Map<string, { ax: number; ay: number; w: number; h: number; parent?: ElkNode }>
) {
    const passes = 2;
    for (let pass = 0; pass < passes; pass++) {
        for (const [targetId, sources] of predsByTarget) {
            if (!sources.length) continue;
            const tgtAbs = abs.get(targetId);
            if (!tgtAbs) continue;

            const centersY: number[] = [];
            for (const sid of sources) {
                const s = abs.get(sid);
                if (!s) continue;
                centersY.push(s.ay + s.h / 2);
            }
            if (!centersY.length) continue;

            const parent = parentById.get(targetId);
            if (!parent) continue;
            const parentAbs = abs.get(parent.id);
            const parentAy = parentAbs ? parentAbs.ay : 0;

            let desiredCenterY: number;
            if (centersY.length === 1) {
                desiredCenterY = centersY[0];
            } else {
                const minC = Math.min(...centersY);
                const maxC = Math.max(...centersY);
                desiredCenterY = (minC + maxC) / 2;
            }

            const newY = desiredCenterY - tgtAbs.h / 2 - parentAy;
            const elkTarget = findElkNode(root, targetId);
            if (elkTarget) {
                elkTarget.y = newY;
                const parentAbs2 = abs.get(parent.id);
                const ax = (elkTarget.x ?? 0) + (parentAbs2 ? parentAbs2.ax : 0);
                const ay = (elkTarget.y ?? 0) + (parentAbs2 ? parentAbs2.ay : 0);
                abs.set(targetId, { ax, ay, w: tgtAbs.w, h: tgtAbs.h, parent });
            }
        }
    }
}

function findElkNode(root: ElkNode, id: string): ElkNode | undefined {
    if (root.id === id) return root;
    for (const c of root.children ?? []) {
        if (c.id === id) return c;
        const r = findElkNode(c, id);
        if (r) return r;
    }
    return undefined;
}
