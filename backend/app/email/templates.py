# Branded HTML result emails for the training exercise.
# Tables and inline styles, because that is what mail apps (Gmail, Outlook) render reliably.

import html
from datetime import datetime
from pathlib import Path

LOGO_CID = "phishsimulator-logo"
LOGO_PNG = (Path(__file__).parent / "assets" / "logo.png").read_bytes()

# The app's own theme colours (frontend/src/styles/theme.css)
FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif"
NAVY = "#0a0e14"
CARD = "#11161d"
PRIMARY = "#2f81f7"
SKY = "#38bdf8"
MUTED = "#57606a"
FAINT = "#8c959f"
LINE = "#e1e4e8"
SOFT = "#f6f8fa"
TONES = {"red": "#cf222e", "green": "#1a7f37", "amber": "#9a6700", "slate": "#57606a"}

GOOD_HABITS = (
    ("Check the sender", "Read the full email address, not just the display name."),
    ("Hover before you click", "See where a link really goes before you open it."),
    ("Report, don't just delete", "Use the report link so IT can warn everyone else."),
)
GENUINE_SIGNS = (
    "The sender's address matched the real organisation's domain.",
    "The link went to the organisation's real website.",
    "There was no pressure to act immediately or share a password.",
)


def _variant(is_phishing, outcome, via_attachment):
    """Wording for one result: subject, tag, tone, headline, intro, list heading, list items, tips."""
    if is_phishing and outcome == "CLICKED" and via_attachment:
        return ("You opened a simulated attachment", "TRAINING TEST", "red",
                "You opened the attachment.",
                "It was part of a safe PhishSimulator training exercise, so no file was downloaded and "
                "nothing on your device changed. In a real attack, an attachment like this could carry malware.",
                "What gave it away", None, GOOD_HABITS)
    if is_phishing and outcome == "CLICKED":
        return ("You clicked a simulated phishing link", "TRAINING TEST", "red",
                "You clicked the link.",
                "It was part of a safe PhishSimulator training exercise. Nothing was installed and none of "
                "your details were taken.",
                "What gave it away", None, GOOD_HABITS)
    if is_phishing and outcome == "REPORTED":
        return ("Well spotted: you reported the training email", "WELL SPOTTED", "green",
                "You reported it. Exactly right.",
                "That email was a PhishSimulator training exercise, and reporting it is the best response. "
                "In real life, your report warns IT before anyone else is caught out.",
                "The warning signs you caught", None, GOOD_HABITS[:2])
    if is_phishing and outcome == "IGNORED":
        return ("You didn't fall for the training email", "EXERCISE CLOSED", "slate",
                "You didn't fall for it.",
                "You left a PhishSimulator training email alone, which kept you safe. Reporting it would have "
                "been even better, because a report warns everyone else too.",
                "The warning signs it had", None, (GOOD_HABITS[2],))
    if outcome == "CLICKED":
        return ("Correct: that email was genuine", "GENUINE EMAIL", "green",
                "You trusted a genuine email.",
                "That was right. The email was a genuine message in a PhishSimulator training exercise, "
                "so opening it was safe.",
                "Why it was genuine", GENUINE_SIGNS, ())
    if outcome == "REPORTED":
        return ("False alarm: that email was genuine", "FALSE ALARM", "amber",
                "That email was genuine.",
                "Being careful is good, but this training email was real, so reporting it was a false alarm. "
                "No harm done.",
                "How to tell next time", GENUINE_SIGNS, ())
    return ("Your training result: a genuine email", "EXERCISE CLOSED", "slate",
            "You skipped a genuine email.",
            "No harm done. It was a genuine message in a PhishSimulator training exercise. "
            "When unsure, check the sender and the link rather than ignoring it.",
            "Why it was genuine", GENUINE_SIGNS, ())


def result_email(outcome, is_phishing, via_attachment, first_name, sender, subject, attachment, cues, xp, feedback_url):
    """The result email a player gets when their campaign email closes: good or bad, with feedback.
    Returns (subject, plain text, html, inline images)."""
    (mail_subject, tag, tone, headline, intro, list_heading, fixed_items, tips) = _variant(
        is_phishing, outcome, via_attachment)
    items = list(fixed_items) if fixed_items else (cues or ["The sender, the link and the pressure to act did not add up."])
    greeting = f"Hi {first_name}" if first_name else "Hi there"
    colour = TONES[tone]
    year = datetime.now().year

    email_rows = [("From", sender or ""), ("Subject", subject or "")]
    if attachment:
        email_rows.append(("Attachment", attachment))

    text = "\n".join([
        f"{greeting},",
        "",
        headline,
        intro,
        "",
        f"{xp:+d} XP applied to your account." if xp else "No XP change.",
        "",
        "THE EMAIL",
        *[f"{label}: {value}" for label, value in email_rows],
        "",
        list_heading.upper(),
        *[f"{number}. {item}" for number, item in enumerate(items, start=1)],
        "",
        *[f"- {lead}: {detail}" for lead, detail in tips],
        "",
        f"See your feedback: {feedback_url}",
        "",
        "This message is part of an authorised PhishSimulator security awareness exercise. "
        "You don't need to do anything else.",
        f"(c) {year} PhishSimulator. All rights reserved.",
    ])

    tips_block = ""
    if tips:
        tips_block = f"""<tr><td style="padding:32px 40px 0">
    {_section_title("Next time")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      {"".join(_tip(lead, detail) for lead, detail in tips)}
    </table>
  </td></tr>"""

    body = f"""\
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>{html.escape(mail_subject)}</title></head>
<body style="margin:0;padding:0;background:{SOFT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{SOFT}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0"
       style="max-width:600px;width:100%;background:#ffffff;font-family:{FONT};color:{NAVY}">

  {_header()}

  <tr><td style="padding:40px 40px 0">
    <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:1.5px;color:{colour}">
      &#9679;&nbsp; {html.escape(tag)}</p>
    <h1 style="margin:0;font-size:32px;line-height:38px;font-weight:700;letter-spacing:-0.5px;color:{NAVY}">
      {html.escape(headline)}</h1>
    <p style="margin:16px 0 0;font-size:16px;line-height:24px;color:{MUTED}">
      {html.escape(greeting)}. {html.escape(intro)}</p>
  </td></tr>

  {_xp_total(xp)}

  <tr><td style="padding:32px 40px 0">{_divider()}</td></tr>

  <tr><td style="padding:28px 40px 0">
    {_section_title("The email")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      {"".join(_row(label, value, last=index == len(email_rows) - 1) for index, (label, value) in enumerate(email_rows))}
    </table>
  </td></tr>

  <tr><td style="padding:32px 40px 0">
    {_section_title(list_heading)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      {"".join(_numbered(number, item) for number, item in enumerate(items, start=1))}
    </table>
  </td></tr>

  {tips_block}

  <tr><td style="padding:36px 40px 40px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:{PRIMARY};border-radius:8px">
        <a href="{html.escape(feedback_url, quote=True)}"
           style="display:inline-block;padding:15px 28px;font-family:{FONT};font-size:16px;font-weight:700;
                  color:#ffffff;text-decoration:none">See your feedback</a>
      </td>
    </tr></table>
    <p style="margin:14px 0 0;font-size:13px;line-height:20px;color:{FAINT}">
      Sign in to PhishSimulator to see this result in your inbox, with your XP and rank.</p>
  </td></tr>

  <tr><td style="background:{SOFT};padding:28px 40px 36px">
    <p style="margin:0;font-size:12px;line-height:19px;color:{MUTED}">
      This message is part of an authorised PhishSimulator security awareness exercise, sent only to
      enrolled participants. You don't need to do anything else.</p>
    <p style="margin:16px 0 0;font-size:12px;line-height:19px;color:{FAINT}">
      This is an automated training message. Replies are not monitored.</p>
    <p style="margin:16px 0 0;font-size:12px;line-height:19px;color:{FAINT}">
      &copy; {year} PhishSimulator. All rights reserved.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>"""

    return mail_subject, text, body, {LOGO_CID: LOGO_PNG}


def _header():
    """App-navy bar with the logo and wordmark."""
    return f"""<tr><td style="background:{NAVY};padding:20px 40px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="36" style="padding-right:12px"><img src="cid:{LOGO_CID}" width="36" height="36" alt=""
           style="display:block;border:0;border-radius:8px"></td>
      <td style="font-family:{FONT};font-size:20px;font-weight:700;letter-spacing:-0.3px;color:#ffffff">PhishSimulator</td>
      <td align="right" style="font-family:{FONT};font-size:12px;color:{SKY}">Security training</td>
    </tr></table>
  </td></tr>"""


def _xp_total(xp):
    """The XP change, shown big like a receipt total."""
    if xp > 0:
        colour, value = TONES["green"], f"+{xp}&nbsp;XP"
    elif xp < 0:
        colour, value = TONES["red"], f"&minus;{abs(xp)}&nbsp;XP"
    else:
        colour, value = TONES["slate"], "0&nbsp;XP"
    return f"""<tr><td style="padding:32px 40px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{SOFT};border-radius:12px">
      <tr>
        <td style="padding:20px 24px;font-family:{FONT};font-size:14px;line-height:20px;color:{MUTED}">
          Applied to your<br>PhishSimulator account</td>
        <td align="right" style="padding:20px 24px;font-family:{FONT};font-size:40px;line-height:44px;
                                 font-weight:700;letter-spacing:-1px;color:{colour}">{value}</td>
      </tr>
    </table>
  </td></tr>"""


def _divider():
    return f'<div style="height:1px;line-height:1px;font-size:0;background:{LINE}">&nbsp;</div>'


def _section_title(text):
    return (f'<p style="margin:0 0 12px;font-family:{FONT};font-size:20px;line-height:28px;font-weight:700;'
            f'color:{NAVY}">{html.escape(text)}</p>')


def _row(label, value, last=False):
    """Receipt-style line: label on the left, value on the right."""
    border = "" if last else f"border-bottom:1px solid {LINE};"
    return (f'<tr><td style="{border}padding:12px 0;font-family:{FONT};font-size:14px;color:{MUTED};'
            f'white-space:nowrap;vertical-align:top;width:100px">{html.escape(label)}</td>'
            f'<td style="{border}padding:12px 0;font-family:{FONT};font-size:14px;line-height:20px;color:{NAVY};'
            f'text-align:right">{html.escape(value)}</td></tr>')


def _numbered(number, text):
    """A list item with a numbered circle in the app's card colour."""
    return (f'<tr><td width="36" style="padding:8px 12px 8px 0;vertical-align:top">'
            f'<div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:{CARD};color:#ffffff;'
            f'text-align:center;font-family:{FONT};font-size:12px;font-weight:700">{number}</div></td>'
            f'<td style="padding:8px 0;font-family:{FONT};font-size:16px;line-height:24px;color:{NAVY}">'
            f'{html.escape(text)}</td></tr>')


def _tip(lead, detail):
    """A next-time step: bold lead with a short explanation."""
    return (f'<tr><td style="padding:10px 0;border-bottom:1px solid {LINE};font-family:{FONT};font-size:15px;'
            f'line-height:22px;color:{NAVY}"><strong>{html.escape(lead)}</strong><br>'
            f'<span style="color:{MUTED}">{html.escape(detail)}</span></td></tr>')
