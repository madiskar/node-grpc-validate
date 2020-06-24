import {
  GenericCallHandler,
  GenericServiceCall,
  NextFunction,
  ChainServerDuplexStream,
  ChainServerWritableStream,
  ChainServerReadableStream,
  ChainServerUnaryCall,
} from '@mdkr/grpc-chain';
import joi from '@hapi/joi';
import * as jspb from 'google-protobuf';
import { status } from 'grpc';

export async function validate(payload: jspb.Message, schema: joi.ObjectSchema): Promise<joi.ValidationError | null> {
  const err = (await schema.validateAsync(payload.toObject())).error;
  if (err) {
    return err;
  }
  return null;
}

export function defaultErrorHandler(err: joi.ValidationError, call: GenericServiceCall): void {
  if (call.ctx.method.responseStream) {
    call = call as
      | ChainServerDuplexStream<jspb.Message, jspb.Message>
      | ChainServerWritableStream<jspb.Message, jspb.Message>;
    call.sendErr({
      name: err.name,
      message: err.message,
      code: status.INVALID_ARGUMENT,
      details: err.details.join('; '),
    });
  } else {
    call = call as
      | ChainServerUnaryCall<jspb.Message, jspb.Message>
      | ChainServerReadableStream<jspb.Message, jspb.Message>;
    call.sendUnaryErr({
      name: err.name,
      message: err.message,
      code: status.INVALID_ARGUMENT,
      details: err.details.join('; '),
    });
  }
}

export type ValidationErrorHandler = (err: joi.ValidationError, call: GenericServiceCall, next: NextFunction) => void;

export interface ValidationOptions {
  errorHandler?: ValidationErrorHandler;
  unaryRequestSchema?: joi.ObjectSchema;
  inboundStreamSchema?: joi.ObjectSchema;
}

export default function (opts: ValidationOptions): GenericCallHandler {
  return async (call: GenericServiceCall, next: NextFunction) => {
    if (!call.ctx.method.requestStream) {
      call = call as
        | ChainServerUnaryCall<jspb.Message, jspb.Message>
        | ChainServerWritableStream<jspb.Message, jspb.Message>;

      if (opts.unaryRequestSchema) {
        const err = await validate(call.req, opts.unaryRequestSchema);
        if (err) {
          const errorHandler = opts.errorHandler ?? defaultErrorHandler;
          return errorHandler(err, call, next);
        }
      }
    } else {
      call = call as
        | ChainServerReadableStream<jspb.Message, jspb.Message>
        | ChainServerDuplexStream<jspb.Message, jspb.Message>;

      call.onMsgIn(async (payload, nextGate) => {
        if (opts.inboundStreamSchema) {
          const err = await validate(payload, opts.inboundStreamSchema);
          if (err) {
            const errorHandler = opts.errorHandler ?? defaultErrorHandler;
            return errorHandler(err, call, next);
          }
        }
        nextGate();
      });
    }

    next();
  };
}
