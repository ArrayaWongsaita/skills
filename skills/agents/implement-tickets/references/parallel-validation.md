# Parallel validation / การตรวจสอบ parallel

status: not validated

Record a human validation run as `status: validated YYYY-MM-DD` after native
parallel execution has been exercised and its result reviewed. The wave script
reads this line and sets `parallelValidated` in its JSON output; while the
status is not validated, the Plan prints `parallel not yet validated`.
