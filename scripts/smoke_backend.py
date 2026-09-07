"""Integration fixture for an ISOLATED test installation, never production.

The test backend must use OIDC_ISSUER_URL=http://localhost:19090 and
OIDC_CLIENT_ID=release-test. The fixture serves public signing keys temporarily.
It does not provide a production identity provider or disable JWT validation.
"""
import io
import json
import os
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from PIL import Image

ISSUER='http://localhost:19090'

def main():
    assert os.environ.get('OIDC_ISSUER_URL')==ISSUER, 'Run only in the isolated release-test backend.'
    assert os.environ.get('OIDC_CLIENT_ID')=='release-test'
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    jwk=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    kid='release-test-'+uuid.uuid4().hex
    jwk.update(kid=kid,use='sig',alg='RS256')
    class Fixture(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_GET(self):
            value={'issuer':ISSUER,'jwks_uri':ISSUER+'/keys'} if self.path=='/.well-known/openid-configuration' else {'keys':[jwk]}
            self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(value).encode())
    server=ThreadingHTTPServer(('127.0.0.1',19090),Fixture)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with httpx.Client(base_url='http://localhost:8000/api/v1',timeout=30) as client:
            assert client.get('/health/ready').status_code==200
            assert client.get('/items').status_code==401
            def sign_in():
                subject='release-test-'+uuid.uuid4().hex
                email=subject+'@example.org'
                claims={'sub':subject,'email':email,'email_verified':True,'iss':ISSUER,'aud':'release-test','iat':int(time.time()),'exp':int(time.time())+300}
                token=jwt.encode(claims,key,algorithm='RS256',headers={'kid':kid})
                response=client.post('/auth/sync',json={'external_id':subject,'email':email,'display_name':'Synthetic tester','id_token':token})
                assert response.status_code==200,('sync',response.status_code)
                bad=client.post('/auth/sync',json={'external_id':'different-subject','email':email,'display_name':'Synthetic tester','id_token':token})
                assert bad.status_code==401
                return {'Authorization':'Bearer '+response.json()['access_token']}
            first,second=sign_in(),sign_in()
            image=io.BytesIO();Image.new('RGB',(80,100),(30,80,120)).save(image,format='PNG')
            response=client.post('/items',headers=first,data={'name':'Synthetic blue shirt','type':'top','skip_ai':'true'},files={'image':('synthetic.png',image.getvalue(),'image/png')})
            assert response.status_code==201,('upload',response.status_code,response.text[:200])
            item=response.json()['id']
            assert client.get('/items/'+item,headers=first).status_code==200
            assert client.get('/items/'+item,headers=second).status_code==404
            response=client.post('/outfits/studio',headers=first,json={'items':[item],'name':'Synthetic release outfit','occasion':'casual'})
            assert response.status_code==201,('outfit',response.status_code,response.text[:200])
            outfit=response.json()['id']
            assert client.get('/outfits/'+outfit,headers=first).status_code==200
            assert client.get('/outfits/'+outfit,headers=second).status_code==404
            print('PASS: database readiness, anonymous rejection, signed OIDC login, subject mismatch rejection, clothing upload, owner isolation, and saved outfit retrieval.')
    finally:
        server.shutdown();server.server_close()

if __name__=='__main__':main()
