# clawdy
Assistant vibes

Setup for hosting in GCP with firestore. 
Needs app.yaml and .env for local hosting

Local uses same Firestore as production

Testing in local:
**Simulate telegram webhook**
localhost:8080/webhook
{    "message": {"chat": {"id": 123}, "text": "Hello assistant"}}

localhost:8080/heartbeat
