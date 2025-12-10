/**
 * Represent the application configuration, which not editable to the user.
 */
export interface AppConfig {
    version: string;
}


/**
 * Represent the user configuration, which is editable to the user.
 */
export interface UserConfig {

}

/**
 * Request body for POST /api/execute endpoint
 */
export interface ApiExecutePostRequestBody {
  name: string;
  data: any;
}