# Decides whether a link looks suspicious, and says why in words a learner can read.
# Having a link is not a warning sign on its own: genuine messages link to the sender's real website too.

import re
from functools import lru_cache
from urllib.parse import urlsplit

# A brand name and the domains it really uses. A link that uses the name anywhere else is impersonating it.
BRANDS = {
    "microsoft": ("microsoft.com", "office.com", "live.com", "outlook.com", "microsoftonline.com", "sharepoint.com"),
    "outlook": ("outlook.com", "live.com", "office.com", "microsoft.com"),
    "paypal": ("paypal.com",),
    "apple": ("apple.com", "icloud.com"),
    "icloud": ("icloud.com", "apple.com"),
    "google": ("google.com", "gmail.com", "youtube.com", "google.co.za"),
    "amazon": ("amazon.com", "amazon.co.za", "amazon.co.uk"),
    "netflix": ("netflix.com",),
    "facebook": ("facebook.com", "fb.com", "meta.com", "facebookmail.com"),
    "instagram": ("instagram.com",),
    "linkedin": ("linkedin.com",),
    "whatsapp": ("whatsapp.com",),
    "fedex": ("fedex.com",),
    "takealot": ("takealot.com",),
    "onedrive": ("live.com", "microsoft.com", "sharepoint.com"),
    "tiktok": ("tiktok.com",),
    "postnet": ("postnet.co.za",),
    "nsfas": ("nsfas.org.za",),
    "sassa": ("sassa.gov.za",),
    "capitec": ("capitecbank.co.za",),
    "nedbank": ("nedbank.co.za",),
    "standardbank": ("standardbank.co.za",),
    "americanexpress": ("americanexpress.com", "aexp.com"),
    "wellsfargo": ("wellsfargo.com",),
    "bankofamerica": ("bankofamerica.com", "bofa.com"),
    "bofa": ("bankofamerica.com", "bofa.com"),
    "dropbox": ("dropbox.com", "dropboxmail.com"),
    "docusign": ("docusign.com", "docusign.net"),
    "office365": ("office.com", "microsoft.com", "office365.com"),
    "wetransfer": ("wetransfer.com",),
    "usaa": ("usaa.com",),
    # Short names only count as a whole word (so "ups" does not match "groups")
    "amex": ("americanexpress.com", "aexp.com"),
    "ebay": ("ebay.com",),
    "usps": ("usps.com",),
    "irs": ("irs.gov",),
    "dhl": ("dhl.com", "dhl.co.za"),
    "ups": ("ups.com",),
    "fnb": ("fnb.co.za",),
    "absa": ("absa.co.za",),
    "sars": ("sars.gov.za",),
    "pudo": ("pudo.co.za",),
}
# How to write a brand in a sentence (others are capitalised)
BRAND_NAMES = {
    "fnb": "FNB", "dhl": "DHL", "ups": "UPS", "sars": "SARS", "nsfas": "NSFAS", "sassa": "SASSA", "pudo": "PUDO",
    "paypal": "PayPal", "linkedin": "LinkedIn", "whatsapp": "WhatsApp", "icloud": "iCloud", "fedex": "FedEx",
    "standardbank": "Standard Bank", "tiktok": "TikTok", "onedrive": "OneDrive", "postnet": "PostNet",
    "americanexpress": "American Express", "amex": "Amex", "wellsfargo": "Wells Fargo",
    "bankofamerica": "Bank of America", "bofa": "Bank of America", "docusign": "DocuSign", "office365": "Office 365", "ebay": "eBay",
    "usps": "USPS", "irs": "IRS", "wetransfer": "WeTransfer", "usaa": "USAA",
}
SHORT_BRAND = 4
# Short names that no ordinary word contains, so they count inside a longer word too ("unblockbofaprepaid")
SHORT_BRANDS_INSIDE_WORDS = {"bofa"}

SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly", "rb.gy", "shorturl.at", "tiny.cc",
              "rebrand.ly", "t.ly", "s.id", "v.gd", "bit.do", "short.gy", "tiny.one", "shorturl.asia", "qrco.de"}
# Free forwarding addresses: like a shortener, the address shown is not where the link goes
FORWARDERS = {"come.to"}
# Tunnels, free hosts and free website builders that put anyone's page online in minutes: a bank or employer
# does not send you to a sign-in page there ("Microsoft password expires... http://vc12w.jimdo.com/")
TEMPORARY_HOSTS = {"ngrok.io", "ngrok-free.app", "ngrok.app", "trycloudflare.com", "000webhostapp.com", "loca.lt",
                   "serveo.net", "jimdo.com", "jimdosite.com", "weebly.com", "wixsite.com", "webflow.io",
                   "godaddysites.com", "yolasite.com", "site123.me", "firebaseapp.com", "web.app", "glitch.me",
                   "netlify.app", "vercel.app", "pages.dev", "repl.co", "herokuapp.com", "blogspot.com"}
UNUSUAL_ENDINGS = (".xyz", ".top", ".tk", ".ml", ".ga", ".cf", ".gq", ".click", ".zip", ".icu", ".rest", ".cam", ".work",
                   ".info", ".support", ".help")
BAIT_WORDS = ("secure", "verify", "login", "signin", "account", "update", "support", "confirm", "billing",
              "portal", "refund", "claim", "redeliver", "reward")
# Domains with a two-part ending, so that "evil.co.za" is the site, not "co.za"
TWO_PART_ENDINGS = ("co.za", "org.za", "ac.za", "gov.za", "net.za", "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au")
# The same for any country: "com.bd", "gov.in", "co.ke" are endings, so "meeha.com.bd" is the site
COUNTRY_SECOND_LEVEL = ("com", "co", "org", "net", "gov", "ac", "edu")
# Numbers that scammers use in place of letters ("1" can stand for "l" or "i")
DIGIT_SWAPS = (
    str.maketrans({"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t"}),
    str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t"}),
)

URL_PATTERN = re.compile(r"(?:https?://|www\.)[^\s<>\"'()\]]+", re.IGNORECASE)
# A web address written without http:// or www., such as "login.cPanel.net/verify" (not part of an email address)
BARE_DOMAIN = re.compile(
    r"(?<![@\w./-])(?:[a-z0-9-]+\.)+(?:com|net|org|info|biz|io|co|za|xyz|top|ru|cn|online|site|app|support|help"
    r"|ly|gd|me|cc|link|click|shop)"
    r"(?![\w@-])(?:/[^\s<>\"'()\]]*)?", re.IGNORECASE)


def find_urls(text):
    """Every web address in the text: with http:// or www., hidden behind [button text](url), or bare."""
    text = text or ""
    found = [url.rstrip(".,;:!?") for url in URL_PATTERN.findall(text)]
    found += [url.rstrip(".,;:!?") for url in BARE_DOMAIN.findall(URL_PATTERN.sub(" ", text))]
    return found


def _split(url):
    """The parts of a URL, or None when it is too broken to read (e.g. an unclosed "[" in old mail)."""
    try:
        return urlsplit(url if "://" in url else f"http://{url}")
    except ValueError:
        return None


def host_of(url):
    """The host name of a URL, lower case and without "www."; empty when the URL cannot be read."""
    parts = _split(url)
    try:
        host = ((parts.hostname if parts else "") or "").lower()
    except ValueError:  # a malformed port or bracket only surfaces when the host is read
        return ""
    return host[4:] if host.startswith("www.") else host


def site_of(host):
    """The part of a host name that someone registered: "login.paypal.com.evil.ru" -> "evil.ru"."""
    labels = host.split(".")
    country_ending = len(labels) >= 3 and len(labels[-1]) == 2 and labels[-2] in COUNTRY_SECOND_LEVEL
    size = 3 if country_ending or any(host.endswith("." + ending) for ending in TWO_PART_ENDINGS) else 2
    return ".".join(labels[-size:])


@lru_cache(maxsize=8192)
def _brand_in(host):
    """The brand a host name mentions, either written plainly or with numbers for letters.
    Cached: mail corpora repeat the same few hosts thousands of times, and the answer depends only on the host."""
    words = re.split(r"[.\-]", host)
    plain = " ".join(words)
    swapped = [plain.translate(swap) for swap in DIGIT_SWAPS]
    for brand in BRANDS:
        if len(brand) <= SHORT_BRAND and brand not in SHORT_BRANDS_INSIDE_WORDS:
            found_plain = brand in words
            found_swapped = any(brand in text.split() for text in swapped)
        else:
            found_plain = brand in plain
            found_swapped = any(brand in text for text in swapped)
        if found_plain or found_swapped:
            return brand, not found_plain
    return None, False


def brand_named_in(text):
    """The brand a sender's display name or mailbox claims to be ("PayPal Support", "American Express Team",
    "paypalservice" in paypalservice@mail.ru), or None. A brand is a word, up to three words written together
    ("American Express"), or the start of a word ("paypalservice"); never the middle or end of one, so
    "Pineapple Farm" is not Apple. Short names (DHL, FNB) must be a whole word."""
    words = [word for word in re.split(r"[^a-z0-9]+", (text or "").lower()) if word]
    for size in (1, 2, 3):
        for start in range(len(words) - size + 1):
            joined = "".join(words[start:start + size])
            for brand in BRANDS:
                if joined == brand or (len(brand) > SHORT_BRAND and size == 1 and joined.startswith(brand)):
                    return brand
    return None


def brand_name(brand):
    """A brand as written in a sentence: FNB, PayPal, Microsoft."""
    return BRAND_NAMES.get(brand, brand.title())


def link_problems(url):
    """Why a link looks suspicious, as short sentences. An empty list means nothing looks wrong."""
    host = host_of(url)
    if not host:
        return []
    site = site_of(host)
    problems = []

    if "@" in (_split(url).netloc if _split(url) else ""):
        problems.append(f"the real address is the part after the '@' ({host})")
    if re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", host):
        problems.append("it uses a number (IP address) instead of a website name")
    elif site.split(".")[0].isdigit():
        problems.append(f"{site} is only a number, not a name a real organisation would use")
    if site in SHORTENERS:
        problems.append(f"{site} is a link shortener that hides where it really goes")
    if site in FORWARDERS:
        problems.append(f"{site} is a free forwarding address that hides where the link really goes")
    if site in TEMPORARY_HOSTS:
        problems.append(f"{site} is a free website builder or temporary host, which real organisations don't use "
                        "for sign-in or payment pages")

    brand, uses_numbers = _brand_in(host)
    if brand and site not in BRANDS[brand]:
        name = brand_name(brand)
        if uses_numbers:
            problems.append(f"{site} imitates {name} by swapping letters for numbers")
        else:
            problems.append(f"it uses the name {name} but is not {name}'s real site ({BRANDS[brand][0]})")
    elif re.search(r"[a-z]\d[a-z]", site.split(".")[0]):
        problems.append(f"{site} swaps a letter for a number to look like a real name")

    name = site.split(".")[0]
    if re.search(r"-(za|sa)$", name) and not site.endswith(".za"):
        problems.append(f"{site} adds '{name.rsplit('-', 1)[1]}' to look South African, but real local sites end in .za")
    if "-" in name and any(word in name for word in BAIT_WORDS) and not problems:
        problems.append(f"{site} adds words like 'secure', 'portal' or 'login' to look official")
    if site.endswith(UNUSUAL_ENDINGS):
        problems.append(f"the ending {'.' + site.rsplit('.', 1)[1]} is rarely used by real companies")
    return problems


def suspicious_links(text):
    """[(url, problems)] for each link in the text that looks suspicious."""
    found = []
    for url in dict.fromkeys(find_urls(text)):
        problems = link_problems(url)
        if problems:
            found.append((url, problems))
    return found


def describe_link(url):
    """One readable line about a link: what is wrong with it, or that it looks genuine."""
    host = host_of(url)
    problems = link_problems(url)
    if not problems:
        return f"{host}: looks genuine"
    return problems[0] if site_of(host) in problems[0] else f"{host}: {problems[0]}"


def explain_links(text):
    """One line per suspicious link, e.g. "m1crosoft.com imitates Microsoft by swapping letters for numbers"."""
    return [describe_link(url) for url, _ in suspicious_links(text)]
