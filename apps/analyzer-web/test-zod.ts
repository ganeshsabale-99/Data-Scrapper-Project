import { z } from "zod";
const schema = z.object({
  opt: z.string().optional().refine(() => true)
});
console.log(schema.shape.opt.isOptional());
