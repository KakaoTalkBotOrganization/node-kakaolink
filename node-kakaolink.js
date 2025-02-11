const { AES } = require('crypto-js');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { load } = require('cheerio');

class KakaoLink {
    #apiKey;
    #cookies = {};
    #referer = null;
    #kakaoStatic = 'sdk/1.36.6 os/javascript lang/en-US device/Win32 origin/';

    /**
     * 카카오 SDK 초기화
     * @param {String} apiKey - 카카오 계정 JavaScript 키
     * @param {String} location - 카카오 디벨로퍼에 추가한 사이트 도메인중 하나
    **/        
    constructor(apiKey, location) {
        if (apiKey.constructor !== String || location.constructor !== String) {
            throw new TypeError('매개변수의 타입은 String이어야 합니다.');
        }
        if (apiKey.length !== 32) {
            throw new ReferenceError('API KEY는 32자여야 합니다.');
        }
        if (!/^http(s)?\:\/\/.+/.test(location)) {
            throw new ReferenceError('도메인 주소의 형식이 올바르지 않습니다.');
        }

        this.#apiKey = apiKey;
        this.#kakaoStatic += encodeURIComponent(location);
    }

    /**
     * 로그인
     * @param {String} email - 카카오 계정 아이디
     * @param {String} password - 카카오 계정 비밀번호
    **/
    async login(email, password) {
        if (email.constructor !== String) {
            throw new TypeError('이메일의 타입은 String이어야 합니다.');
        }
        if (password.constructor !== String) {
            throw new TypeError('비밀번호의 타입은 String이어야 합니다.');
        }
        if (!this.#apiKey) {
            throw new ReferenceError('로그인 메서드를 카카오 SDK가 초기화되기 전에 호출하였습니다.');
        }

        // AES 키 얻기
        const loginResponse = await fetch('https://accounts.kakao.com/login?continue=https%3A%2F%2Faccounts.kakao.com%2Fweblogin%2Faccount%2Finfo', {
            method: 'GET',
            headers: { 
                'User-Agent': this.#kakaoStatic,
                'referer': 'https://accounts.kakao.com'
            }
        });

        switch (loginResponse.status) {
            case 401:
                throw new ReferenceError('유효한 API KEY가 아닙니다.');
            case 200:
                this.#referer = loginResponse.url;
                const $ = load(await loginResponse.text());
                const cryptoKey = $('input[name=p]').attr('value');

                const cookies = this.#getCookies(loginResponse);
                Object.assign(this.#cookies, {
                    _kadu: cookies['_kadu'],
                    _kadub: cookies['_kadub'],
                    _maldive_oauth_webapp_session_key: cookies['_maldive_oauth_webapp_session_key'],
                    TIARA: this.#getCookies(await fetch('https://stat.tiara.kakao.com/track?d=%7B%22sdk%22%3A%7B%22type%22%3A%22WEB%22%2C%22version%22%3A%221.1.15%22%7D%7D'))['TIARA']
                });

                // ASE키를 기반으로 로그인 정보 전송 및 쿠키 저장
                const form = new FormData();
                form.append('os', 'web');
                form.append('webview_v', '2');
                form.append('email', String(AES.encrypt(email, cryptoKey)));
                form.append('password', String(AES.encrypt(password, cryptoKey)));
                form.append('continue', decodeURIComponent(this.#referer.split('continue=')[1]));
                form.append('third', 'false');
                form.append('k', 'true');
                const response = await fetch('https://accounts.kakao.com/weblogin/authenticate.json', {
                    body: form,
                    method: 'POST',
                    headers: {
                        'User-Agent': this.#kakaoStatic,
                        'Referer': this.#referer,
                        'Cookie': this.#pickCookies(Object.keys(this.#cookies), this.#cookies)
                    }
                });

                const jsonText = await response.text();
                switch (JSON.parse(jsonText).status) {
                    case -450:
                        throw new ReferenceError('이메일 또는 비밀번호가 올바르지 않습니다.');
                    case -481:
                    case -484:
                        throw new ReferenceError(jsonText);
                    case 0:
                        const cookies = this.#getCookies(response);
                        Object.assign(this.#cookies, {
                            _kawlt: cookies['_kawlt'],
                            _kawltea: cookies['_kawltea'],
                            _karmt: cookies['_karmt'],
                            _karmtea: cookies['_karmtea']
                        });
                        break;
                    default:
                        throw new Error(`로그인 도중 에러가 발생하였습니다.\n${jsonText}`);
                }
                break;
            default:
                throw new Error('API KEY 인증 과정에서 에러가 발생하였습니다.');
        }
    }

    /**
     * 카카오링크 전송
     * @param {String} room - 카카오링크를 보낼 방 이름
     * @param {String} params - 카카오링크 탬플릿 파라미터
     * @param {String} [type] - 카카오링크 탬플릿 타입
    **/
    async send(room, params, type = 'custom') {
        const form = new FormData();
        form.append('app_key', this.#apiKey);
        form.append('validation_action', type);
        form.append('validation_params', JSON.stringify(params));
        form.append('ka', this.#kakaoStatic);
        form.append('lcba', '');
        const response = await fetch('https://sharer.kakao.com/talk/friends/picker/link', {
            body: form,
            method: 'POST',
            headers: {
                'User-Agent': this.#kakaoStatic,
                'Referer': this.#referer,
                'Cookie': this.#pickCookies(['TIARA', '_kawlt', '_kawltea', '_karmt', '_karmtea'], this.#cookies)
            }
        });

        switch (response.status) {
            case 400:
                //console.error(await response.text());
                throw new ReferenceError('템플릿 객체가 올바르지 않거나, Web 플랫폼에 등록된 도메인과 현재 도메인이 일치하지 않습니다.');
            case 200:
                const cookies = this.#getCookies(response);
                Object.assign(this.#cookies, {
                    KSHARER: cookies['KSHARER'],
                    using: 'true'
                });
                const $ = load(await response.text());
                const validatedTalkLink = $('#validatedTalkLink').attr('value');
                const csrfToken = $('div').last().attr('ng-init')?.split("'")[1];
                if (!csrfToken) {
                    throw new ReferenceError('로그인 세션이 만료되어서 다시 로그인 해야합니다.');
                }

                const { chats, securityKey } = await (
                    await fetch('https://sharer.kakao.com/api/talk/chats', {
                        headers: {
                            'User-Agent': this.#kakaoStatic,
                            'Referer': 'https://sharer.kakao.com/talk/friends/picker/link',
                            'Csrf-Token': csrfToken,
                            'App-Key': this.#apiKey,
                            'Cookie': this.#pickCookies(Object.keys(this.#cookies), this.#cookies)
                        }
                    })
                ).json();

                const chat = chats?.find((v) => v.title === room);
                if (!chat?.id) {
                    throw new ReferenceError(`방 이름 ${room}을 찾을 수 없습니다.`);
                }

                await fetch('https://sharer.kakao.com/api/talk/message/link', {
                    body: JSON.stringify({
                        receiverChatRoomMemberCount: [1],
                        receiverIds: [chat.id],
                        receiverType: 'chat',
                        securityKey: securityKey,
                        validatedTalkLink: JSON.parse(validatedTalkLink)
                    }),
                    method: 'POST',
                    headers: {
                        'User-Agent': this.#kakaoStatic,
                        'Referer': 'https://sharer.kakao.com/talk/friends/picker/link',
                        'Csrf-Token': csrfToken,
                        'App-Key': this.#apiKey,
                        'Content-Type': 'application/json;charset=UTF-8',
                        'Cookie': this.#pickCookies(['KSHARER', 'TIARA', 'using', '_kadu', '_kadub', '_kawlt', '_kawltea', '_karmt', '_karmtea'], this.#cookies)
                    }
                });
                break;
            default:
                throw new Error('템플릿 인증 과정 중에 알 수 없는 오류가 발생하였습니다.');
        }
    }

    #getCookies(response) {
        const cookies = {};
        response.headers
            .get('set-cookie')
            .split(',')
            .forEach((v) => {
                const [key, val] = v.split(';')[0].split('=');
                cookies[key.trim()] = val?.trim() ?? '';
            });
        return cookies;
    }

    #pickCookies(keys, cookies) {
        return keys.map((key) => `${key}=${cookies[key]}`).join('; ');
    }
}

module.exports = KakaoLink;