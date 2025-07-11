export interface IEvent<TBody, TPathParameters, TQueryStringParameters> {
  body?: TBody;
  requestContext?: {
    authorizer?: {
      userRoles?: string;
    };
  };
  pathParameters?: TPathParameters;
  headers?: {
    Authorization?: string;
    authorization?: string;
  };
  methodArn?: string;
  queryStringParameters?: TQueryStringParameters;
  Records?: any[];
  userPoolId?: string;
}
