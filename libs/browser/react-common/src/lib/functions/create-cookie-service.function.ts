import Cookies from 'universal-cookie';

export function createCookieService() {
    const domain = location.origin.split('//')[1].split(':')[0];

    return new Cookies(null, { path: '/', domain, sameSite: 'lax', httpOnly: false });
}