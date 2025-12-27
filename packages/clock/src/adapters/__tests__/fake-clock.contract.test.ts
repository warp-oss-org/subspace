import { describeClockContract } from "../../ports/__tests__/clock.contract"
import { FakeClock } from "../fake-clock"

describeClockContract({
  name: "FakeClock",
  make: () => new FakeClock(Date.now()),
})
