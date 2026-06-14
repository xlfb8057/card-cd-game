/**
 * 可视化日志工具
 * 用于 AI 调试与战斗日志输出
 */

/** 日志级别 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Logger 接口 */
export interface ILogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/**
 * 控制台日志实现
 * 可通过依赖注入替换为 UI 战斗日志
 */
export class ConsoleLogger implements ILogger {
  constructor(private readonly _prefix: string = '[PixelBrawl]') {}

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const tag = `${this._prefix}[${level.toUpperCase()}]`;
    if (data !== undefined) {
      console[level === 'debug' ? 'log' : level](tag, message, data);
    } else {
      console[level === 'debug' ? 'log' : level](tag, message);
    }
  }
}
