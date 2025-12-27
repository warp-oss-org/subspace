import { describeClockContract } from "../../ports/__tests__/clock.contract"
import { SystemClock } from "../system-clock"

describeClockContract({
  name: "SystemClock",
  make: () => new SystemClock(),
})
