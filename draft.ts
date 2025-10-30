interface PathItem {
    id: string;
    path: string;
}

interface TreeNode {
    id: string;
    children: TreeNode[];
}

function buildTree(items: PathItem[]): TreeNode[] {
    const root: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    const sortedItems = [...items].sort((a, b) => {
        const depthA = a.path.split('.').length;
        const depthB = b.path.split('.').length;
        return depthA - depthB;
    });

    for (const item of sortedItems) {
        const parts = item.path.split('.');
        const nodeId = parts[parts.length - 1];

        let node = nodeMap.get(item.path);
        if (!node) {
            node = { id: nodeId, children: [] };
            nodeMap.set(item.path, node);
        }

        if (parts.length === 1) {
            if (!root.find(n => n.id === nodeId)) {
                root.push(node);
            }
        } else {
            const parentPath = parts.slice(0, -1).join('.');
            let parent = nodeMap.get(parentPath);

            if (!parent) {
                parent = { id: parts[parts.length - 2], children: [] };
                nodeMap.set(parentPath, parent);

                if (parts.length === 2) {
                    root.push(parent);
                }
            }

            if (!parent.children.find(c => c.id === nodeId)) {
                parent.children.push(node);
            }
        }
    }

    return root;
}

function buildTreeCompact(items: PathItem[]): TreeNode[] {
    const nodeMap = new Map<string, TreeNode>();

    const getOrCreateNode = (path: string): TreeNode => {
        if (!nodeMap.has(path)) {
            const parts = path.split('.');
            const node: TreeNode = { id: parts[parts.length - 1], children: [] };
            nodeMap.set(path, node);

            if (parts.length > 1) {
                const parentPath = parts.slice(0, -1).join('.');
                const parent = getOrCreateNode(parentPath);
                if (!parent.children.some(c => c.id === node.id)) {
                    parent.children.push(node);
                }
            }
        }
        return nodeMap.get(path)!;
    };

    items.forEach(item => getOrCreateNode(item.path));

    return items
        .filter(item => !item.path.includes('.'))
        .map(item => nodeMap.get(item.path)!);
}

const items: PathItem[] = [
    { id: '1', path: 'A' },
    { id: '2', path: 'A.b' },
    { id: '3', path: 'A.b.c' },
    { id: '4', path: 'B' },
    { id: '5', path: 'B.a' },
    { id: '6', path: 'B.b' },
    { id: '7', path: 'B.a.a' }
];

const tree = buildTree(items);
console.log(JSON.stringify(tree, null, 2));
