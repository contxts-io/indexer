/* eslint-disable @typescript-eslint/no-explicit-any */

import { Request, RouteOptions } from "@hapi/hapi";
import Joi from "joi";

import { edb } from "@/common/db";
import { logger } from "@/common/logger";
import { formatEth } from "@/common/utils";

const version = "v1";

export const getDailyVolumesV1Options: RouteOptions = {
  description: "Get historical volume data for a collection",
  notes: "Get date, volume, rank and sales count for each collection",
  tags: ["api", "4. NFT API"],
  plugins: {
    "hapi-swagger": {
      order: 62,
    },
  },
  validate: {
    query: Joi.object({
      id: Joi.string()
        .lowercase()
        .description(
          "Filter to a particular collection, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"
        )
        .required(),
      limit: Joi.number().default(60).description("Rows to return"),
      startTimestamp: Joi.number().description("The start timestamp you want to filter on (UTC)"),
      endTimestamp: Joi.number().description("The end timestamp you want to filter on (UTC)"),
    }),
  },
  response: {
    schema: Joi.object({
      collections: Joi.array().items(
        Joi.object({
          id: Joi.string(),
          timestamp: Joi.number(),
          volume: Joi.number().unsafe(true),
          rank: Joi.number(),
          floor_sell_value: Joi.number().unsafe(true),
          sales_count: Joi.number(),
        }).allow(null)
      ),
    }).label(`getDailyVolumes${version.toUpperCase()}Response`),
    failAction: (_request, _h, error) => {
      logger.error(`get-daily-volumes-${version}-handler`, `Wrong response schema: ${error}`);
      throw error;
    },
  },
  handler: async (request: Request) => {
    const query = request.query as any;

    let baseQuery = `
        SELECT
          collection_id AS id,
          timestamp,
          volume,
          rank,
          floor_sell_value,
          sales_count                    
        FROM daily_volumes
      `;

    baseQuery += ` WHERE collection_id = $/id/`;

    // We default in the code so that these values don't appear in the docs
    if (!query.startTimestamp) {
      query.startTimestamp = 0;
    }
    if (!query.endTimestamp) {
      query.endTimestamp = 9999999999;
    }

    baseQuery += " AND timestamp >= $/startTimestamp/ AND timestamp <= $/endTimestamp/";

    baseQuery += ` ORDER BY timestamp DESC`;

    baseQuery += ` LIMIT $/limit/`;

    try {
      let result = await edb.manyOrNone(baseQuery, query);
      result = result.map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp,
        volume: formatEth(r.volume),
        rank: r.rank,
        floor_sell_value: formatEth(r.floor_sell_value),
        sales_count: r.sales_count,
      }));
      return { collections: result };
    } catch (error: any) {
      logger.error(`get-daily-volumes-${version}-handler`, `Handler failure: ${error}`);
      throw error;
    }
  },
};