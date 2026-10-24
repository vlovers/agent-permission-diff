# Independent AI review

Use a separate reviewer context (another model when practical) plus deterministic tests. AI review is advisory, not a security proof.

## Reviewer input

Provide base and head SHA, diff, acceptance criteria, relevant README/SECURITY documents, exact test output/CI URLs and source code. The author summary is secondary evidence.

## Review priority

1. False assurances about effective permissions, runtime execution or security.
2. False negatives, unknown→allow fallthrough, exit 3 precedence, `complete: false`, report schema and compatibility drift.
3. Untrusted Git object access, script execution, credential leaks, unsafe fork/CI permissions or mutable dependency usage.
4. Test or oracle circularity, fixture-only success and misleading consumer evidence.
5. Packaging/CLI bin exports/TypeScript API, maintainability and scope creep.

Each finding includes severity, file/location, affected invariant, concrete evidence or reproduction, remediation and recommended regression test. Distinguish confirmed defects from speculation.

Block acceptance on high-severity correctness, security, supply-chain and compatibility findings. Medium issues need disposition and follow-up. Record reviewer identity, reviewed base/head SHA, CI evidence and disposition of findings in the PR. An AI reviewer (even a different model) does not constitute an authorized GitHub approval. Reassess material changes after the reviewed head SHA; independent review does not replace maintainer approval, real installed-package checks or documented runtime-coverage limitations.
