// src/features/jobs/elk-layout.ts
import ELK from "elkjs/lib/elk.bundled.js";
import type { Job, Task } from "@/features/jobs/types";
import type { Node, Edge, Position } from "@xyflow/react";

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

export async function createElkLayout(
    job: Job,
    opts?: {
        algorithm?: "layered" | "mrtree" | "force";
        direction?: "DOWN" | "RIGHT" | "UP" | "LEFT";
        spacing?: number;
        padding?: number;
    }
): Promise<{ nodes: TaskExecutionNode[]; edges: TaskEdge[] }> {
    const algorithm = opts?.algorithm ?? "layered";
    const direction = opts?.direction ?? "RIGHT";
    const spacing = String(opts?.spacing ?? 32);
    const padding = String(opts?.padding ?? 16);

    const taskIndex = new Map<string, { task: Task; runId: string }>();
    const children = buildElkChildren(job, taskIndex);

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
        edges: buildElkEdges(job),
    };

    const layout = (await elk.layout(elkGraph)) as ElkNode;

    // --- Post-traitement d’alignement suivant les dépendances ---
    const allElkEdges = buildElkEdges(job);
    const predsByTarget = indexPredsByTarget(allElkEdges);
    const parentById = new Map<string, ElkNode>();
    const abs = new Map<string, { ax: number; ay: number; w: number; h: number; parent?: ElkNode }>();
    collectAbs(layout, 0, 0, parentById, abs);
    centerTargetsBetweenPredecessors(layout, predsByTarget, parentById, abs);
    // -------------------------------------------------------------

    const nodes: TaskExecutionNode[] = [];
    flattenToReactFlowNodes(layout, taskIndex, undefined, nodes);
    const edges: TaskEdge[] = buildRfEdgesFromIndex(taskIndex);
    return { nodes, edges };
}

/* ---------------------------- helpers ---------------------------- */

function buildElkChildren(
    job: Job,
    taskIndex: Map<string, { task: Task; runId: string }>
): ElkNode[] {
    const res: ElkNode[] = [];
    const tasks = Object.values(job.task_executions ?? {});

    for (const t of tasks) {
        taskIndex.set(t.task_id, { task: t, runId: job.run_id });

        if (t.task_type === "flow") {
            const childJob = t.subflow_execution as Job;
            res.push({
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
                children: buildElkChildren(childJob, taskIndex),
            });
        } else {
            res.push({
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
    return res;
}

function buildElkEdges(job: Job): ElkEdge[] {
    const all: ElkEdge[] = [];
    const stack: Job[] = [job];

    while (stack.length) {
        const j = stack.pop()!;
        const tasks = Object.values(j.task_executions ?? {});
        for (const t of tasks) {
            for (const dep of t.dependencies ?? []) {
                all.push({ id: `${dep}__to__${t.task_id}`, sources: [dep], targets: [t.task_id] });
            }
            if (t.task_type === "flow" && t.subflow_execution) stack.push(t.subflow_execution as Job);
        }
    }
    return uniqEdges(all);
}

function uniqEdges(edges: ElkEdge[]): ElkEdge[] {
    const seen = new Set<string>();
    const out: ElkEdge[] = [];
    for (const e of edges) if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
    return out;
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

        const baseHandles = {
            sourcePosition: "right" as Position,
            targetPosition: "left" as Position,
        };

        const width = c.width ?? (isGroup ? DEFAULT_GROUP.width : DEFAULT_LEAF.width);
        const height = c.height ?? (isGroup ? DEFAULT_GROUP.height : DEFAULT_LEAF.height);

        acc.push({
            id: c.id,
            position: { x: c.x ?? 0, y: c.y ?? 0 },
            data: info ? { label: info.task.task_id, ...info.task, run_id: info.runId } : { label: c.id },
            parentId,
            extent: parentId ? "parent" : undefined,
            style: { width, height },
            ...baseHandles,
        });

        if (isGroup) {
            flattenToReactFlowNodes(c, taskIndex, c.id, acc);
        }
    }
}

function buildRfEdgesFromIndex(
    taskIndex: Map<string, { task: Task; runId: string }>
): TaskEdge[] {
    const edges: TaskEdge[] = [];
    for (const { task } of taskIndex.values()) {
        for (const dep of task.dependencies ?? []) {
            edges.push({
                id: `${task.task_id}-${dep}`,
                source: dep,
                target: task.task_id,
                type: "smoothstep",
                animated: true,
                data: task as Task,
            });
        }
    }
    const uniq = new Map<string, TaskEdge>();
    for (const e of edges) if (!uniq.has(e.id)) uniq.set(e.id, e);
    return Array.from(uniq.values());
}

/* --------------- centrage selon les prédécesseurs ---------------- */

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

function centerTargetsBetweenPredecessors(
    root: ElkNode,
    predsByTarget: Map<string, string[]>,
    parentById: Map<string, ElkNode>,
    abs: Map<string, { ax: number; ay: number; w: number; h: number; parent?: ElkNode }>
) {
    const passes = 2; // stabilise les chaînes A->B->C

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
                desiredCenterY = centersY[0]; // suivre le prédécesseur
            } else {
                const minC = Math.min(...centersY);
                const maxC = Math.max(...centersY);
                desiredCenterY = (minC + maxC) / 2; // au milieu des branches
            }

            const newY = desiredCenterY - tgtAbs.h / 2 - parentAy;

            const elkTarget = findElkNode(root, targetId);
            if (elkTarget) {
                elkTarget.y = newY;

                // met à jour l'index absolu pour la passe suivante
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
