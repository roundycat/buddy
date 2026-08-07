# Hackathon Demonstration Checklist

**Project:** Beddy (Bedi)  
**Audience:** Judges · mentors · 5–8 minute live demo  
**Public URL (update if changed):** see `scripts/deploy/last-deploy-url.txt` / `docs/demo/step7-demo.md`

---

## 0. Story in one breath

> Beddy is a secret friend for kids in hospital. Emotions become flowers, wishes become leaves, days become a storybook — and parents see warm summaries, never the child’s private chat.

Keep the demo **magical**, not clinical.

---

## 1. T−24h preparation

- [ ] Production (or stable staging) URL opens on presenter laptop + backup phone
- [ ] ECS task healthy · recent deploy known-good
- [ ] `LLM_FALLBACK_TO_MOCK=false` (real Bedrock answers)
- [ ] Guardrail + KB IDs present in task env
- [ ] Demo accounts work:

| Role | Email | Password |
|------|-------|----------|
| Child | `demo@bedi.app` | `BeddyDemo26!` |
| Guardian | `guardian@bedi.app` | `BeddyGuard26!` |

- [ ] Optional second child `mina@bedi.app` if first account is dirty
- [ ] CloudWatch dashboard tab ready (optional judge deep-dive)
- [ ] Screenshots / offline video backup of chat + garden + parent home
- [ ] Airplane mode test of backup video

---

## 2. T−1h warm-up (do this)

1. [ ] Log in as **child** · confirm persona waiting room loads  
2. [ ] Send **2 short chat turns** (warm Haiku / cache)  
3. [ ] Open **Emotion Garden** · ensure at least one flower or plant path works  
4. [ ] Open **Wish Tree** · one leaf hanging or ready to hang  
5. [ ] Open **Adventure** · at least one quest visible  
6. [ ] Log out · log in as **guardian** · confirm linked child + home cards  
7. [ ] Ask one parent report question that should cite KB / summary  
8. [ ] Log out · leave browsers on `/login`  
9. [ ] (Optional) Trigger cron only if you need fresh parent prep — don’t during the pitch

**Avoid before stage:** storybook seal + mass illustration (slow + costly). Prefetch one sealed book if you will show it.

---

## 3. Live script (≈6 minutes)

| Time | Beat | Click path | Say |
|------|------|------------|-----|
| 0:00 | Hook | `/login` | “Kids in hospital need a friend who isn’t a chart.” |
| 0:30 | Friend | Child login → waiting room | “Meet Beddy — a secret companion.” |
| 1:15 | Chat | 1–2 SSE turns | “Answers stream instantly; heavy AI waits for night.” |
| 2:00 | Garden | `/garden` | “Feelings aren’t logged — they grow into flowers.” |
| 2:45 | Wish | `/wish` | “Hopes hang on a tree the child can touch.” |
| 3:20 | Adventure | `/adventure` | “Tiny quests for a ward day.” |
| 4:00 | Privacy turn | Logout → guardian | “Parents worry too — but privacy comes first.” |
| 4:30 | Parent home | `/guardian` | “Summaries and empathy — never raw chat.” |
| 5:15 | Architecture | One slide / CloudWatch | “DynamoDB, Bedrock, EventBridge dawn batch, Bridge filter.” |
| 5:45 | Close | Storybook cover or garden | “Discharge becomes a story they keep.” |

---

## 4. Architecture talking points (30 seconds)

```
Child message → Haiku stream (Guardrail) → done
Night: EventBridge → memory / emotion / stories / parent / KB
Parent: AI Bridge → summaries + Knowledge Base → Opus
Stores: DynamoDB single table · S3 private blobs
```

Point at: Orchestrator · Bridge · no Aurora · CloudWatch `Beddy`.

---

## 5. Performance talking points

- First-token path moved from Opus → **Haiku** (~34% faster in STEP 1 bench)
- SSE unlocks input before persist
- Emotion / memory / stories **batched at dawn** — not on every tap
- Metrics: latency, errors, tokens, estimated AI cost

---

## 6. Privacy talking points (judges love this)

- Parent APIs **cannot** read raw chat or diary
- KB docs are **summaries** under `kb-summaries/{childId}/`
- Bridge drops transcript-like text and coordinates
- Guardian link via invite code · role-separated middleware

---

## 7. If something breaks on stage

| Symptom | Move |
|---------|------|
| Chat hangs | Refresh · second turn · show pre-recorded SSE clip |
| Bedrock error / mock tone | Don’t apologize mid-sentence · jump to garden/wish (local-feel UI) |
| Guardian empty | Re-link with invite · or show parent screenshot |
| Slow storybook | Skip seal · show cover / empty magical state only |
| Total outage | Play backup video · narrate architecture over it |

Never debug IAM live.

---

## 8. Q&A crib

| Question | Answer |
|----------|--------|
| Is this medical advice? | No — companion + emotional support framing · safety redirects to caregivers |
| Where is data? | DynamoDB + private S3 · us-east-1 · Bedrock for inference |
| Why not Postgres? | Single-table Dynamo for child-scoped docs · Aurora retired |
| Cost control? | Haiku hot path · Opus batch · CloudWatch AiCostUsd |
| Parent sees chat? | No — Bridge + DTO contract |
| Production ready? | Hackathon/pilot ready · TLS & secret hardening on checklist |

---

## 9. Day-of kit

- [ ] Presenter laptop charged + HDMI/USB-C dongle  
- [ ] Phone hotspot backup  
- [ ] Incognito windows: Child · Guardian (no leftover sessions)  
- [ ] Font zoom 110–125% for projector  
- [ ] Notifications off · Do Not Disturb  
- [ ] This checklist printed or second screen  

---

## 10. Post-demo

- [ ] Log out all demo sessions  
- [ ] Note any bugs judges hit → Technical Debt  
- [ ] If URL was public: rotate demo passwords after the event  

---

**Demo success criteria:** judges feel warmth + understand privacy + see real AWS (Bedrock stream, Dynamo-backed garden, parent summary). Perfect uptime is secondary to a clear story.
