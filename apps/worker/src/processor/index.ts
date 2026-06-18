import { JobType } from "../utils/job.types";
import calculatePrimes from "./prime-number.processor";
import hashPassword from "./hash-password.processor";
import sortLargeArray from "./sort-array.processor";

export async function processJob(jobType: JobType, payload: string) {
  switch (jobType) {
    case "prime":
      calculatePrimes(Number(payload));
      break;
    case "bcrypt":
      await hashPassword(payload);
      break;
    case "sorting":
      sortLargeArray(Number(payload));
      break;
    default:
      console.log(`Unknown job type: ${jobType}`);
      break;
  }
}
