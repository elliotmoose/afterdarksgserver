export interface ISQLTableColumn {
    COLUMN_NAME: string
    DATA_TYPE: string
    COLUMN_KEY: string
    CHARACTER_MAXIMUM_LENGTH: number
    IS_NULLABLE: number
    COLUMN_DEFAULT?: string
}