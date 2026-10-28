"""Render synthetic account templates only; never import app routes or open a database."""

import argparse
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--root", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
r = args.root.resolve()
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=True)
e = Environment(
    loader=FileSystemLoader(r / "src/omakase/lite/templates"), autoescape=select_autoescape()
)
base = dict(
    account_asset_version="synthetic-review", csrf_token="synthetic-csrf", user=None, error=None
)
user = dict(display_name="Alex", role="admin")
item = dict(
    id=1,
    title="A deliberately long synthetic recommendation title for responsive reading",
    url="https://example.test/title",
    reasoning="A synthetic recommendation reason. Patient character writing and a thoughtful mystery make this a useful fixture for checking long text and comfortable reading.",
    predicted_score=8.7,
    tracker_sync_state="pending",
    tracker_sync_detail="Waiting to sync. Your local progress is saved.",
    watched_episodes=4,
    watched_score=8,
    feedback_state="watched",
    watch_status="current",
)
dashboard = dict(
    user=user,
    anilist_connection=None,
    anilist_available=True,
    provider_keys={},
    provider_options={"openai": "OpenAI", "anthropic": "Anthropic"},
    taste_profile="",
    saved=[item],
    watching=[item],
    watched=[item],
    history=[
        dict(
            created_at="2026-10-28 10:30 UTC",
            provider="openai",
            mode="recommendations",
            recommendations=[item],
        )
        for _ in range(8)
    ],
)
admin = dict(user=user, focus="", requests=[], accepted_invitations=[])
accepted = dict(
    id=1,
    public_number=107,
    display_name="Synthetic member with a long display name",
    email="long.member.address.for.layout@example.test",
    contact="",
    note="A generic invitation used only for layout checking.",
    invite_kind="direct",
    accepted_at="2026-10-28T10:30:00Z",
)
request = dict(accepted, status="pending")
fixtures = {
    "login": ("login.html", {}),
    "login-error": ("login.html", dict(error="Email or password did not match. Try again.")),
    "invite": ("invite.html", {}),
    "invite-error": (
        "invite.html",
        dict(error="This invitation is no longer available. Ask the owner for a new link."),
    ),
    "dashboard": ("dashboard.html", dashboard),
    "dashboard-empty": (
        "dashboard.html",
        dict(dashboard, saved=[], watching=[], watched=[], history=[], anilist_available=False),
    ),
    "dashboard-connected": (
        "dashboard.html",
        dict(
            dashboard,
            anilist_connection={"anilist_username": "synthetic_member"},
            provider_keys={"openai": {"hint": "test"}},
        ),
    ),
    "dashboard-long-name": (
        "dashboard.html",
        dict(
            dashboard,
            user=dict(
                display_name="SyntheticMemberWithAnUnusuallyLongUnbrokenDisplayNameForWrapping",
                role="member",
            ),
        ),
    ),
    "admin-empty": ("admin_requests.html", admin),
    "admin": (
        "admin_requests.html",
        dict(admin, accepted_invitations=[accepted], requests=[request]),
    ),
}
for name, (template, context) in fixtures.items():
    (out / (name + ".html")).write_text(
        e.get_template(template).render(**dict(base, **context)), encoding="utf-8"
    )
print(f"Rendered {len(fixtures)} synthetic account fixtures; no database or provider accessed.")
