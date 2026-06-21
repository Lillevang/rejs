/** Default plan shown on first load so the app is never empty. */
export const EXAMPLE_DSL = `trip "Interrail Summer"
currency: EUR
start: Oslo
end: Rome

hop Copenhagen:
  dates: 2026-07-01 .. 2026-07-04
  budget: 320 EUR
  arrive_by: flight
  travel: 1h 30m
  note: "Nyhavn & Tivoli"
  activity: Tivoli Gardens
  activity: Round Tower @ 2026-07-02

hop Berlin:
  stay: 3d
  budget: 240 EUR
  arrive_by: train
  travel: 7h

hop Prague:
  stay: 2d
  budget: 180 EUR
  arrive_by: train
  travel: 4h 30m

hop Vienna:
  stay: 4d
  budget: 360 EUR
  arrive_by: train
  travel: 4h
  activity: Schönbrunn Palace
  activity: Vienna State Opera @ 2026-07-13

hop Venice:
  stay: 3d
  budget: 420 EUR
  arrive_by: train
  travel: 7h 30m
  activity: St Mark's Basilica
`;
