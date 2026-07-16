# 67 — Armenian provision parser

Implemented deterministic Armenian/Russian/English parsing for article, part, point and alphabetic subpoint, including prefix/suffix ordinal forms, decimals, hyphenated ranges and mixed punctuation. Output is a canonical `a:/p:/pt:/sp:` key.

Hostile instruction text is rejected unless the caller explicitly marks the source structure trusted. Parser/guard suite: 5/5 passed. No values are extracted from arbitrary candidate body text for identifier scoring.

Evidence: `artifacts/prompt19_4_parser_fixtures.json`.
