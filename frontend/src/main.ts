import { authService } from './services/auth.service';
import { homeTemplate, notFoundTemplate } from './templates';
import { sanitizeHTML } from './utils/helpers';

import {
  renderLoginPage,
  renderRegisterPage,
  renderOAuth2FAPage,
  renderProfilePage,
  renderFriendsPage,
  renderTournamentPage,
  renderPongPage,
  renderUserProfilePage,
  renderStatsPage,
} from './pages';

class Router {
  private routes: Record<string, () => void>;
  private currentPongGame: any = null;
  private friendsSearchClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor() {
    this.routes = {
      '/': this.homePage.bind(this),
      '/login': this.loginPage.bind(this),
      '/register': this.registerPage.bind(this),
      '/game/pong': this.pongPage.bind(this),
      '/profile': this.profilePage.bind(this),
      '/friends': this.friendsPage.bind(this),
      '/tournament': this.tournamentPage.bind(this),
      '/stats': this.statsPage.bind(this),
      '/oauth-2fa': this.oauth2FAPage.bind(this),
    };
  }

  public async init(): Promise<void> {
    await authService.checkServerSession();
    await authService.verifyAuth();
    await authService.handleOAuthCallback(() => this.updateNavigation());

    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches('[data-route]')) {
        e.preventDefault();
        const route = target.getAttribute('data-route') || target.getAttribute('href') || '/';
        this.navigateTo(route);
      }
    });

    window.addEventListener('popstate', () => {
      this.loadRoute();
    });

    this.updateNavigation();
    this.loadRoute();
  }

  public navigateTo(route: string): void {
    history.pushState(null, '', route);
    this.loadRoute();
  }

  private loadRoute(): void {
    const path = window.location.pathname;

    const userProfileMatch = path.match(/^\/user\/(\d+)$/);
    if (userProfileMatch) {
      this.cleanup();
      this.userProfilePage(parseInt(userProfileMatch[1], 10));
      return;
    }

    const handler = this.routes[path] || this.notFound.bind(this);

    this.cleanup();

    document.querySelectorAll('#main-nav a').forEach((link) => {
      link.classList.remove('active');
      const linkRoute = link.getAttribute('data-route') || link.getAttribute('href');
      if (linkRoute === path) {
        link.classList.add('active');
      }
    });

    handler();
  }

  private cleanup(): void {
    if (this.currentPongGame) {
      if (this.currentPongGame.destroy) {
        this.currentPongGame.destroy();
      } else if (this.currentPongGame.stop) {
        this.currentPongGame.stop();
      }
      this.currentPongGame = null;
    }

    if (this.friendsSearchClickHandler) {
      document.removeEventListener('click', this.friendsSearchClickHandler);
      this.friendsSearchClickHandler = null;
    }

    const overlayIds = [
      'tournament-result-overlay',
      'game-over-overlay',
      'ready-overlay',
      'countdown-overlay',
    ];
    for (const id of overlayIds) {
      document.getElementById(id)?.remove();
    }
  }

  public updateNavigation(): void {
    const isAuthenticated = authService.isAuthenticated();
    const user = authService.currentUser;

    const nav = document.getElementById('main-nav');
    if (!nav) return;

    if (isAuthenticated && user) {
      nav.innerHTML = `
        <a href="/" data-route="/">Accueil</a>
        <a href="/game/pong" data-route="/game/pong">Pong</a>
        <a href="/tournament" data-route="/tournament">Tournoi</a>
        <a href="/stats" data-route="/stats">Stats</a>
        <a href="/friends" data-route="/friends">Amis</a>
        <a href="/profile" data-route="/profile">Profil (${sanitizeHTML(user.display_name)})</a>
      `;
    } else {
      nav.innerHTML = `
        <a href="/" data-route="/">Accueil</a>
        <a href="/login" data-route="/login">Connexion</a>
        <a href="/register" data-route="/register">Inscription</a>
        <a href="/game/pong" data-route="/game/pong">Pong</a>
        <a href="/tournament" data-route="/tournament">Tournoi</a>
      `;
    }
  }

  private getAuthContext() {
    return {
      navigateTo: this.navigateTo.bind(this),
      updateNavigation: this.updateNavigation.bind(this),
      apiBaseUrl: '/api',
    };
  }

  private getProfileContext() {
    return {
      navigateTo: this.navigateTo.bind(this),
      updateNavigation: this.updateNavigation.bind(this),
    };
  }

  private getFriendsContext() {
    return {
      navigateTo: this.navigateTo.bind(this),
      friendsSearchClickHandler: this.friendsSearchClickHandler,
      setFriendsSearchClickHandler: (handler: ((e: MouseEvent) => void) | null) => {
        this.friendsSearchClickHandler = handler;
      },
    };
  }

  private getTournamentContext() {
    return {
      navigateTo: this.navigateTo.bind(this),
      currentPongGame: this.currentPongGame,
      setCurrentPongGame: (game: any) => {
        this.currentPongGame = game;
      },
    };
  }

  private getPongContext() {
    return {
      navigateTo: this.navigateTo.bind(this),
      currentPongGame: this.currentPongGame,
      setCurrentPongGame: (game: any) => {
        this.currentPongGame = game;
      },
    };
  }

  private getUserContext() {
    return {
      navigateTo: this.navigateTo.bind(this),
    };
  }

  private getStatsContext() {
    return {
      navigateTo: this.navigateTo.bind(this),
    };
  }

  private homePage(): void {
    const content = document.getElementById('content');
    if (!content) return;

    const user = authService.currentUser;
    const isAuthenticated = authService.isAuthenticated();
    content.innerHTML = homeTemplate(user, isAuthenticated);
  }

  private loginPage(): void {
    renderLoginPage(this.getAuthContext());
  }

  private registerPage(): void {
    renderRegisterPage(this.getAuthContext());
  }

  private oauth2FAPage(): void {
    renderOAuth2FAPage(this.getAuthContext());
  }

  private profilePage(): void {
    renderProfilePage(this.getProfileContext());
  }

  private friendsPage(): void {
    renderFriendsPage(this.getFriendsContext());
  }

  private tournamentPage(): void {
    renderTournamentPage(this.getTournamentContext());
  }

  private pongPage(): void {
    renderPongPage(this.getPongContext());
  }

  private userProfilePage(userId: number): void {
    renderUserProfilePage(this.getUserContext(), userId);
  }

  private statsPage(): void {
    renderStatsPage(this.getStatsContext());
  }

  private notFound(): void {
    const content = document.getElementById('content');
    if (content) {
      content.innerHTML = notFoundTemplate();
    }
  }
}

async function initializeApp(): Promise<void> {
  const router = new Router();
  await router.init();

  document.body.classList.add('ready');
}

initializeApp().catch(error => {
  console.error('Failed to initialize app:', error);
  document.body.classList.add('ready');
});
