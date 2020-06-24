import { GenericCallHandler, GenericServiceCall, NextFunction } from '@mdkr/grpc-chain';
import joi from '@hapi/joi';

async function validate(component: unknown, schema?: joi.ObjectSchema): Promise<joi.ValidationError | null> {
  if (!schema) {
    return null;
  }
  const error = (await schema.validateAsync(component)).error;
  if (error) {
    return error;
  }
  return null;
}

export default function (schema: joi.ObjectSchema): GenericCallHandler {
  return async (call: GenericServiceCall, next: NextFunction) => {
    const err = await validate(call);
    next();
  };
}
