import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import { ZodError, type ZodType } from "zod";

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, Promise<T>> {
  constructor(private readonly schema: ZodType<T>) {}

  async transform(value: unknown): Promise<T> {
    try {
      return await this.schema.parseAsync(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: "Request validation failed",
          issues: error.issues.map(({ path, message }) => ({ path, message })),
        });
      }
      throw error;
    }
  }
}
