import "server-only";
import { cache } from "react";

// All date labels in one server render use the same time, including hydration.
export const getRequestTime = cache(() => Date.now());
