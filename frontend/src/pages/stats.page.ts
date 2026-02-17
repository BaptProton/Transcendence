import { authService } from '../services/auth.service';
import { initStats } from '../statistique/stats';

export interface StatsPageContext {
  navigateTo: (route: string) => void;
}

export function renderStatsPage(ctx: StatsPageContext): void {
  if (!authService.isAuthenticated()) {
    ctx.navigateTo('/login');
    return;
  }

  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = '<div id="stats-root"></div>';

  const root = document.getElementById('stats-root');
  if (!root) return;

  initStats(root);
}
