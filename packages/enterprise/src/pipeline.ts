import type { DataSourcePipelineSettings } from "../../back-end/types/datasource";

const UNITS_TABLE_RETENTION_HOURS_DEFAULT = 24;

export function bigQueryCreateTableOptions(
  settings: DataSourcePipelineSettings
) {
  return `OPTIONS(
        expiration_timestamp=TIMESTAMP_ADD(
          CURRENT_TIMESTAMP(), 
          INTERVAL ${
            settings.unitsTableRetentionHours ??
            UNITS_TABLE_RETENTION_HOURS_DEFAULT
          } HOUR
        )
      )`;
}
