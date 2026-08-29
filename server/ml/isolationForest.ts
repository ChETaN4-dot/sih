export type IsolationTreeNode = {
  splitAttribute?: number;
  splitValue?: number;
  left?: IsolationTreeNode;
  right?: IsolationTreeNode;
  size?: number;
  isLeaf: boolean;
};

// Euler-Mascheroni constant
const EULER_MASCHERONI = 0.5772156649;

/**
 * Calculates the average path length of unsuccessful search in a Binary Search Tree (BST)
 * c(n) = 2 * (ln(n-1) + 0.5772156649) - 2*(n-1)/n
 */
export function c(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER_MASCHERONI) - (2 * (n - 1)) / n;
}

export class IsolationTree {
  public root: IsolationTreeNode;

  constructor(data: number[][], currentHeight: number, maxHeight: number) {
    this.root = this.buildTree(data, currentHeight, maxHeight);
  }

  private buildTree(data: number[][], currentHeight: number, maxHeight: number): IsolationTreeNode {
    const numSamples = data.length;
    const numFeatures = data[0]?.length ?? 0;

    if (currentHeight >= maxHeight || numSamples <= 1 || numFeatures === 0) {
      return { isLeaf: true, size: numSamples };
    }

    // Pick a random feature index
    const featureIdx = Math.floor(Math.random() * numFeatures);

    // Find min and max for this feature in data
    let minVal = Number.POSITIVE_INFINITY;
    let maxVal = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < numSamples; i++) {
      const val = data[i][featureIdx];
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }

    if (minVal === maxVal) {
      return { isLeaf: true, size: numSamples };
    }

    // Pick a random split value between min and max
    const splitVal = minVal + Math.random() * (maxVal - minVal);

    const leftData: number[][] = [];
    const rightData: number[][] = [];

    for (let i = 0; i < numSamples; i++) {
      if (data[i][featureIdx] < splitVal) {
        leftData.push(data[i]);
      } else {
        rightData.push(data[i]);
      }
    }

    return {
      isLeaf: false,
      splitAttribute: featureIdx,
      splitValue: splitVal,
      left: this.buildTree(leftData, currentHeight + 1, maxHeight),
      right: this.buildTree(rightData, currentHeight + 1, maxHeight),
    };
  }

  public pathLength(x: number[], node: IsolationTreeNode, currentPathLength: number): number {
    if (node.isLeaf) {
      return currentPathLength + c(node.size ?? 1);
    }

    const attr = node.splitAttribute!;
    const val = node.splitValue!;

    if (x[attr] < val) {
      return this.pathLength(x, node.left!, currentPathLength + 1);
    } else {
      return this.pathLength(x, node.right!, currentPathLength + 1);
    }
  }
}

export class IsolationForest {
  private trees: IsolationTree[] = [];
  private numTrees: number;
  private subSampleSize: number;

  constructor(numTrees = 100, subSampleSize = 256) {
    this.numTrees = numTrees;
    this.subSampleSize = subSampleSize;
  }

  public fit(data: number[][]): void {
    this.trees = [];
    const n = data.length;
    if (n === 0) return;

    const sampleSize = Math.min(n, this.subSampleSize);
    const maxHeight = Math.ceil(Math.log2(Math.max(sampleSize, 2)));

    for (let i = 0; i < this.numTrees; i++) {
      // Subsample without replacement or random sampling
      const subSample: number[][] = [];
      const indices = new Set<number>();
      while (indices.size < sampleSize) {
        const idx = Math.floor(Math.random() * n);
        indices.add(idx);
      }
      for (const idx of indices) {
        subSample.push(data[idx]);
      }

      const tree = new IsolationTree(subSample, 0, maxHeight);
      this.trees.push(tree);
    }
  }

  public computeAnomalyScore(x: number[], nDataSamples: number): number {
    if (this.trees.length === 0 || nDataSamples <= 1) return 0.5;

    let totalPathLength = 0;
    for (const tree of this.trees) {
      totalPathLength += tree.pathLength(x, tree.root, 0);
    }

    const avgPathLength = totalPathLength / this.trees.length;
    const cN = c(nDataSamples);

    if (cN === 0) return 0.5;

    // s = 2 ^ (- avgPathLength / c(n))
    return Math.pow(2, -avgPathLength / cN);
  }

  public predictScores(data: number[][]): number[] {
    const n = data.length;
    return data.map((x) => this.computeAnomalyScore(x, n));
  }
}
