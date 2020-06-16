const HtmlWebPackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const VersionFile = require('webpack-version-file');
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/main.js',
  output: {
    filename: 'index-bundles.js',
    path: path.resolve(__dirname, 'build')
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.(glsl|vert|frag|txt)$/,
        use: {
          loader: 'raw-loader'
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: 'html-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    new HtmlWebPackPlugin({
      template: './src/index.html',
      filename: './index.html',
      favicon: './favicon.ico'
    }),
    new MiniCssExtractPlugin(),
    new VersionFile({
      output: './version.txt',
      data: {
        date: (new Date()).toDateString() + ' ' + [(((new Date()).getHours() < 10) ? '0' : '') + (new Date()).getHours().toString(),
          (((new Date()).getMinutes() < 10) ? '0' : '') + (new Date()).getMinutes().toString(),
          (((new Date()).getSeconds() < 10) ? '0' : '') + (new Date()).getSeconds().toString()].join(':')
      },
      template: './version.ejs'
    })
  ]
};
