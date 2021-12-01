const UserModel = require('../models/user-model');
const bcrypt = require('bcrypt');
const uuid = require('uuid');
const tokenService = require('./token-service');
const UserDto = require('../dtos/user-dto');
const ApiError = require('../exceptions/api-error');

class UserService {
    async registration(email, password) {
        const candidate = await UserModel.findOne({email})
        if (candidate) {
            throw ApiError.BadRequest(`Пользователь с почтовым адресом ${email} уже существует`)
        }
        const hashPassword = await bcrypt.hash(password, 3);
        const activationLink = uuid.v4();

        const user = await UserModel.create({email, password: hashPassword, activationLink})

        const userDto = new UserDto(user);
        const tokens = tokenService.generateTokens({...userDto});
        await tokenService.saveToken(userDto.id, tokens.refreshToken);
        return {...tokens, user: userDto}
    }

    async activate(activationLink) {
        const user = await UserModel.findOne({activationLink})
        if (!user) {
            throw ApiError.BadRequest('Неккоректная ссылка активации')
        }
        user.isActivated = true;
        await user.save();
    }

    async login(email, password, device) {
        const user = await UserModel.findOne({email})
        if (!user) {
            throw ApiError.BadRequest('Пользователь с таким email не найден')
        }
        const isPassEquals = await bcrypt.compare(password, user.password);
        if (!isPassEquals) {
            throw ApiError.BadRequest('Неверный пароль');
        }
        const token = await tokenService.findDevice(device)
        if (!token) {
            const userDto = new UserDto(user);
            const tokens = tokenService.generateTokens({...userDto});

            await tokenService.saveToken(userDto.id, tokens.refreshToken, device);
            return {...tokens, user: userDto}
        }
        let validateToken = await tokenService.validateRefreshToken(token.refreshToken)

        if (!validateToken) {
            await tokenService.removeToken(token.refreshToken)
            const userDto = new UserDto(user);
            const tokens = tokenService.generateTokens({...userDto});

            await tokenService.saveToken(userDto.id, tokens.refreshToken, device);
            return {...tokens, user: userDto}
        }
        const userDto = new UserDto(user);
        const accessToken = tokenService.generateAccessToken({...userDto});

        return {accessToken, refreshToken: token, user: userDto}
    }

    async logout(refreshToken) {
        const token = await tokenService.removeToken(refreshToken);
        return token;
    }

    async refresh(token, device) {
        if (!token) {
            throw ApiError.UnauthorizedError();
        }
        const userData = tokenService.validateRefreshToken(token);
        if (!userData) {
            throw ApiError.UnauthorizedError();
        }
        const tokenFromDb = await tokenService.findToken(token);
        const user = await UserModel.findById(userData.id);
        const userDto = new UserDto(user);
        if (!tokenFromDb || (tokenFromDb.device.toString() !== device.toString())) {
            const tokens = tokenService.generateTokens({...userDto});
            await tokenService.saveToken(userDto.id, tokens.refreshToken);
            return {...tokens, user: userDto}
        }
        const accessToken = await tokenService.generateAccessToken({...userDto})
        return {accessToken, refreshToken: tokenFromDb.refreshToken, user: userDto}
    }

    async getAllUsers() {
        const users = await UserModel.find();
        return users;
    }
}

module.exports = new UserService();
