export class ResourceTracker {
  constructor() {
    this.timeouts = new Set();
    this.intervals = new Set();
  }

  setTimeout(callback, delay, ...args) {
    const timeoutId = setTimeout(() => {
      this.timeouts.delete(timeoutId);
      callback(...args);
    }, delay);
    this.timeouts.add(timeoutId);
    return timeoutId;
  }

  setInterval(callback, delay, ...args) {
    const intervalId = setInterval(callback, delay, ...args);
    this.intervals.add(intervalId);
    return intervalId;
  }

  clearTimeout(timeoutId) {
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(timeoutId);
    }
  }

  clearInterval(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(intervalId);
    }
  }

  clearAll() {
    for (const timeoutId of this.timeouts) {
      clearTimeout(timeoutId);
    }
    this.timeouts.clear();

    for (const intervalId of this.intervals) {
      clearInterval(intervalId);
    }
    this.intervals.clear();
  }

  hasActiveResources() {
    return this.timeouts.size > 0 || this.intervals.size > 0;
  }
}
