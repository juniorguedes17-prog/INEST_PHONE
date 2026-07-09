import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { AuthService } from './services/auth.service';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './constants/auth.constants';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Autentica usuario por e-mail e senha.' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto, this.getRequestContext(request));
    this.setAuthCookies(response, result.tokens.accessToken, result.tokens.refreshToken);

    return {
      user: result.user,
      tokens: {
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
    };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renova o access token a partir do refresh token.' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken =
      refreshTokenDto.refreshToken ?? this.getCookie(request, REFRESH_TOKEN_COOKIE) ?? '';
    const result = await this.authService.refresh(refreshToken, this.getRequestContext(request));
    this.setAuthCookies(response, result.tokens.accessToken, result.tokens.refreshToken);

    return {
      user: result.user,
      tokens: {
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerra a sessao atual.' })
  async logout(
    @Body() logoutDto: LogoutDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken =
      logoutDto.refreshToken ?? this.getCookie(request, REFRESH_TOKEN_COOKIE) ?? undefined;
    const result = await this.authService.logout(
      refreshToken,
      user?.id,
      this.getRequestContext(request),
    );
    this.clearAuthCookies(response);
    return result;
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna os dados da sessao autenticada.' })
  getSession(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getSession(user, user.tokenExpiresAt);
  }

  private setAuthCookies(response: Response, accessToken: string, refreshToken: string) {
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  private clearAuthCookies(response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    response.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  }

  private getCookie(request: Request, name: string): string | null {
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      return null;
    }

    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((cookie) => {
        const [key, ...value] = cookie.trim().split('=');
        return [key, decodeURIComponent(value.join('='))];
      }),
    );

    return cookies[name] ?? null;
  }

  private getRequestContext(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
