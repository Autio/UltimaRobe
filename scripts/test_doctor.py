import unittest
from doctor import validate

class ConfigurationTests(unittest.TestCase):
    def valid(self):
        values = dict(APP_URL='http://localhost:3000', OIDC_ISSUER_URL='https://login.test.org', OIDC_CLIENT_ID='app', OIDC_CLIENT_SECRET='provider-secret')
        for i, key in enumerate(('POSTGRES_PASSWORD','SECRET_KEY','NEXTAUTH_SECRET','SPRITEFY_KEY','IMAGE_RENDER_KEY')):
            values[key] = str(i) * 64
        return values

    def test_complete_configuration(self):
        self.assertEqual(validate(self.valid()), [])

    def test_rejects_template_and_unsafe_urls_without_echoing_secrets(self):
        values=self.valid()
        values.update(OIDC_ISSUER_URL='https://identity.example.com', APP_URL='https://user:supersecret@host.test')
        errors=' '.join(validate(values))
        self.assertIn('example',errors)
        self.assertIn('credentials',errors)
        self.assertNotIn('supersecret',errors)

    def test_rejects_shared_secrets_and_password_url_delimiters(self):
        values=self.valid()
        values['SPRITEFY_KEY']=values['SECRET_KEY']
        values['POSTGRES_PASSWORD']='x'*32+'@'
        self.assertEqual(len(validate(values)),2)

if __name__ == '__main__':
    unittest.main()
