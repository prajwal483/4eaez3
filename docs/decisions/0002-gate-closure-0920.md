# 2. Default gate closure is 09:20, not 11:00

## Context
My first version used 11:00 UK time, the gate closure most write-ups mention. While reviewing, I checked it: 11:00 was the coupled European auction time before Brexit. Since January 2021 the GB day-ahead auctions close at 09:20 (EPEX 60-minute) and 09:50 (N2EX), with an EPEX 30-minute auction at 15:30.

## Decision
Default to 09:20 and let the user switch between the three auctions. Gate closure is an `HH:MM` time, not a whole hour.

## Consequences
The "latest forecast before the gate" changes. At 09:20 the 09:30 WINDFOR run isn't available yet, so the app picks the 07:30 run. Times are UK local, which equals UTC in January; I don't model the hour or so a trader needs to prepare bids.
