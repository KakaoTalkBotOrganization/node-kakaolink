# node-kaling
> The repo was forked in [https://github.com/cjh980402/node-kakaolink].<br/>
> 해당 레포는 [https://github.com/cjh980402/node-kakaolink]를 포크하여 수정하였습니다.
nodejs에서 카카오링크를 사용할 수 있게 합니다.

# 사용법
## 설치(예정)
```shell
npm install node-kaling
```
## 기본 코드
```javascript
//모듈 불러오기 및 SDK 초기화
const { KakaoLink } = require('node-kaling');
let kaling = new KakaoLink(YOUR_API_KEY_HERE, YOUR_APP_DOMAIN_HERE);
await kaling.login(YOUR_USER_ID_HERE, YOUR_USER_PASSWORD_HERE);

// 카링 전송
await kaling.send('마후봇', {
    "link_ver": "4.0",
    'template_id': YOUR_TEMPLATE_ID_HERE,
    'template_args': {
        YOUR_TEMPLATE_ARGS_HERE
    }
}, 'custom')
```