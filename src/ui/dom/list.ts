// Key bazlı liste reconcile — tüm listeyi yeniden kurmaz (01-architecture.md §7.1).
// 200+ satırda basit windowing devreye girer.

const WINDOW_THRESHOLD = 200;

export interface ListRenderer<T> {
  render: (items: T[]) => void;
  destroy: () => void;
}

export const createList = <T>(
  root: HTMLElement,
  keyOf: (item: T) => string,
  create: (item: T) => HTMLElement,
  update: (element: HTMLElement, item: T) => void,
): ListRenderer<T> => {
  const nodes = new Map<string, HTMLElement>();

  return {
    render: (items) => {
      const visible = items.length > WINDOW_THRESHOLD ? items.slice(0, WINDOW_THRESHOLD) : items;
      const seen = new Set<string>();

      visible.forEach((item, index) => {
        const key = keyOf(item);
        seen.add(key);

        let node = nodes.get(key);
        if (!node) {
          node = create(item);
          nodes.set(key, node);
        }
        update(node, item);

        const current = root.children[index];
        if (current !== node) root.insertBefore(node, current ?? null);
      });

      nodes.forEach((node, key) => {
        if (seen.has(key)) return;
        node.remove();
        nodes.delete(key);
      });

      while (root.children.length > visible.length) root.lastElementChild?.remove();
    },
    destroy: () => {
      nodes.forEach((node) => node.remove());
      nodes.clear();
    },
  };
};
