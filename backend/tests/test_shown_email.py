# Tests for how addresses are shown: test players' aliases of the demo inbox hide that inbox

import unittest

from flask import Flask

from app.utils.emails import shown_email


def _shown(address, demo_email="owner.name01@gmail.com"):
    app = Flask(__name__)
    app.config["DEMO_EMAIL"] = demo_email
    with app.app_context():
        return shown_email(address)


class ShownEmailTests(unittest.TestCase):

    def test_alias_of_the_demo_inbox_hides_the_inbox(self):
        self.assertEqual(_shown("owner.name01+zanele.mashaba@gmail.com"), "•••+zanele.mashaba@gmail.com")
        self.assertEqual(_shown("Owner.Name01+Sipho@Gmail.com"), "•••+Sipho@Gmail.com")

    def test_other_addresses_are_shown_as_they_are(self):
        for address in (
            "owner.name01@gmail.com",            # the owner's own account
            "someone+work@gmail.com",            # another person's alias
            "owner.name01+zanele@outlook.com",   # same name, other domain
            "owner.name012+zanele@gmail.com",    # a longer mailbox that only starts the same
            "owner.name01+@gmail.com",           # nothing after the plus
            "lerato.mokoena@phishsimulator.test",
            "",
        ):
            self.assertEqual(_shown(address), address, address)

    def test_nothing_is_hidden_without_a_demo_inbox(self):
        self.assertEqual(_shown("owner.name01+zanele@gmail.com", demo_email=""), "owner.name01+zanele@gmail.com")


if __name__ == "__main__":
    unittest.main()
