# KDS V1 pre-production security gate

No production KDS mutation rollout until every required item is PASS.

- [ ] Staff browser contains no service-role key or Telegram bot token.
- [ ] Staff authentication is server-side and revocable.
- [ ] Staff location authorization is derived server-side.
- [ ] Cross-location order read test passes.
- [ ] Cross-location transition test passes.
- [ ] Offline mode disables mutations.
- [ ] Revision conflict returns 409/reconciliation behavior.
- [ ] One canonical transition creates exactly one history row.
- [ ] Idempotent replay creates no additional transition.
- [ ] Cancellation/rejection reason policy passes.
- [ ] Telegram webhook secret is validated.
- [ ] Telegram operational/admin actions are not anonymous.
- [ ] Internal order notification cannot be triggered anonymously.
- [ ] Telegram uses canonical transition path at cutover.
- [ ] Customer place-order flow passes regression.
- [ ] Customer token status flow passes regression.
- [ ] Staff notification flow passes regression.
- [ ] Rollback procedure has been exercised in isolated environment.
- [ ] Explicit production rollout approval recorded.
