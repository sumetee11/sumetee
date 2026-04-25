# Security Specification - Robotic Arena Challenge

## 1. Data Invariants
- **Scores**: Must reference a valid `teamId` and `competitionId`. The `score` value must be a non-negative number and should not exceed the competition's `maxScore`.
- **Teams**: Must have at least 2 members. `levelKey` must be a valid competition type.
- **Users**: Roles are strictly `admin` or `judge`.
- **Hierarchy**: Competition -> Scores. Access to scoring is granted based on the Judge's assigned levels or specific competitions.

## 2. The "Dirty Dozen" Payloads
These payloads should be rejected by the rules:

1. **Identity Spoofing**: Attempt to create a score with a `judgeId` that doesn't match the authenticated user.
2. **Privilege Escalation**: A judge attempting to update another judge's profile or change their own role to `admin`.
3. **Score Boundary Breach**: Setting a score to a negative value or a extremely large number.
4. **Schema Poisoning**: Adding unknown fields to a `Score` document.
5. **PII Leak**: Unauthenticated user trying to list the `users` collection.
6. **Orphaned Score**: Creating a score for a `teamId` that does not exist.
7. **Cross-Level Scoring**: Scoring a team in a competition level they are not registered for.
8. **Unauthorized Competition Mod**: A judge trying to change a competition's `maxScore`.
9. **Team Deletion**: A judge or public user trying to delete a team.
10. **Timestamp Fraud**: Providing a client-side `createdAt` timestamp instead of `request.time`.
11. **Bypassing Max Score**: Updating a score to be higher than the competition's defined limit.
12. **Shadow Field**: Adding a `verified: true` field to a team that only admins should set.

## 3. Test Scenarios (Manual/Logic)
- **Public**: Can READ `scores`, `teams`, `competitions`, `competition_types`. CANNOT WRITE anything.
- **Judge**: Can READ everything. Can CREATE/UPDATE/DELETE `scores`. CANNOT WRITE `teams`, `competitions`, or `users`.
- **Admin**: Can READ and WRITE everything.

## 4. Relationship Table
| Collection | Unauthenticated | Judge | Admin |
|------------|-----------------|-------|-------|
| users | Read (Limited) | Read (Self) | Full |
| competition_types | Read | Read | Full |
| competitions | Read | Read | Full |
| teams | Read | Read | Full |
| scores | Read | Write | Full |
| notifications | None | Read | Full |
