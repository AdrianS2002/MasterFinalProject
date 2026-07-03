
import 'chart.js';
import { ZoomPluginOptions } from 'chartjs-plugin-zoom';

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    zoom?: ZoomPluginOptions;
  }
}
