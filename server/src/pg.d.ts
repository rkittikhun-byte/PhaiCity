/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The part of node-postgres ("pg") the server uses, for type checking without @types/pg.

declare module "pg" {
  interface QueryResult {
    rows: Array<Record<string, any>>;
    rowCount: number | null;
  }

  interface PoolClient {
    query(text: string, params?: unknown[]): Promise<QueryResult>;
    release(): void;
  }

  class Pool {
    constructor(options: { connectionString: string; max?: number });
    query(text: string, params?: unknown[]): Promise<QueryResult>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }

  const pg: { Pool: typeof Pool };
  export default pg;
}
