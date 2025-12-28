import { describeSingleFlightContract } from "../../../ports/__tests__/single-flight.contract"
import { MemorySingleflight } from "../memory-single-flight"

describeSingleFlightContract("MemorySingleflight", () => new MemorySingleflight())
