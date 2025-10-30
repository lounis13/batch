import type { Node, Edge } from '@xyflow/react';
import { ELKLayoutEngine, type LayoutDirection as ELKDirection } from './elk-layout-engine';
import { DagreLayoutEngine, type LayoutDirection as DagreDirection } from './dagre-layout-engine';

export type LayoutAlgorithm = 'elk' | 'dagre';
export type LayoutDirection = 'DOWN' | 'RIGHT' | 'UP' | 'LEFT';

interface LayoutOptions {
  algorithm?: LayoutAlgorithm;
  direction?: LayoutDirection;
  nodeSpacing?: number;
  layerSpacing?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  flowWidth?: number;
  flowHeight?: number;
}

/**
 * Unified Layout Engine
 *
 * Provides a unified interface for both ELK and Dagre layout algorithms.
 * Allows switching between algorithms at runtime.
 */
export class LayoutEngine {
  private algorithm: LayoutAlgorithm;
  private options: LayoutOptions;

  constructor(options: LayoutOptions = {}) {
    this.algorithm = options.algorithm || 'elk';
    this.options = options;
  }

  /**
   * Compute layout using the selected algorithm
   */
  async layout(nodes: Node[], edges: Edge[]): Promise<{ nodes: Node[]; edges: Edge[] }> {
    if (this.algorithm === 'dagre') {
      return this.layoutWithDagre(nodes, edges);
    } else {
      return this.layoutWithELK(nodes, edges);
    }
  }

  /**
   * Layout using ELK
   */
  private async layoutWithELK(nodes: Node[], edges: Edge[]): Promise<{ nodes: Node[]; edges: Edge[] }> {
    const elkDirection = this.convertToELKDirection(this.options.direction || 'DOWN');

    const engine = new ELKLayoutEngine({
      direction: elkDirection,
      nodeSpacing: this.options.nodeSpacing,
      layerSpacing: this.options.layerSpacing,
      nodeWidth: this.options.nodeWidth,
      nodeHeight: this.options.nodeHeight,
      flowWidth: this.options.flowWidth,
      flowHeight: this.options.flowHeight,
    });

    return engine.layout(nodes, edges);
  }

  /**
   * Layout using Dagre
   */
  private async layoutWithDagre(nodes: Node[], edges: Edge[]): Promise<{ nodes: Node[]; edges: Edge[] }> {
    const dagreDirection = this.convertToDagreDirection(this.options.direction || 'DOWN');

    const engine = new DagreLayoutEngine({
      direction: dagreDirection,
      nodeSpacing: this.options.nodeSpacing,
      rankSpacing: this.options.layerSpacing,
      nodeWidth: this.options.nodeWidth,
      nodeHeight: this.options.nodeHeight,
      flowWidth: this.options.flowWidth,
      flowHeight: this.options.flowHeight,
    });

    return engine.layout(nodes, edges);
  }

  /**
   * Convert unified direction to ELK direction
   */
  private convertToELKDirection(direction: LayoutDirection): ELKDirection {
    const map: Record<LayoutDirection, ELKDirection> = {
      'DOWN': 'DOWN',
      'RIGHT': 'RIGHT',
      'UP': 'UP',
      'LEFT': 'LEFT',
    };
    return map[direction];
  }

  /**
   * Convert unified direction to Dagre direction
   */
  private convertToDagreDirection(direction: LayoutDirection): DagreDirection {
    const map: Record<LayoutDirection, DagreDirection> = {
      'DOWN': 'TB',
      'RIGHT': 'LR',
      'UP': 'BT',
      'LEFT': 'RL',
    };
    return map[direction];
  }

  /**
   * Change algorithm
   */
  setAlgorithm(algorithm: LayoutAlgorithm): void {
    this.algorithm = algorithm;
  }

  /**
   * Get current algorithm
   */
  getAlgorithm(): LayoutAlgorithm {
    return this.algorithm;
  }
}
