import bcrypt from 'bcryptjs';

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        bcrypt.compare(password, hash, (err, success) => {
            if (err) {
                reject(err);
            } else {
                resolve(success);
            }
        });
    });
}