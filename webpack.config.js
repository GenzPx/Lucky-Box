const path = require('path');
const fs = require('fs');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WWW = path.resolve(__dirname, 'www');
module.exports = (env, options) => {
  const {
    mode = 'development'
  } = options;
  const rules = [{
    test: /\.tsx?$/,
    exclude: /node_modules/,
    use: ['html-tag-js/jsx/tag-loader.js', {
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-env', '@babel/preset-typescript']
      }
    }, {
      loader: 'ts-loader',
      options: {
        transpileOnly: true
      }
    }]
  }, {
    test: /\.(hbs|md)$/,
    use: ['raw-loader']
  }, {
    test: /\.m.(sa|sc|c)ss$/,
    use: ['raw-loader', 'postcss-loader', 'sass-loader']
  }, {
    test: /\.svg$/,
    resourceQuery: /raw/,
    type: 'asset/source'
  }, {
    test: /\.(png|svg|jpg|jpeg|ico|ttf|webp|eot|woff|webm|mp4|webp|wav)(\?.*)?$/,
    resourceQuery: {
      not: [/raw/]
    },
    type: "asset/resource"
  }, {
    test: /(?<!\.m)\.(sa|sc|c)ss$/,
    use: [{
      loader: MiniCssExtractPlugin.loader
    }, 'css-loader', 'postcss-loader', 'sass-loader']
  }];
  rules.push({
    test: /\.m?js$/,
    exclude: /node_modules\/(@codemirror|codemirror|marked)/,
    use: ['html-tag-js/jsx/tag-loader.js', {
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-env']
      }
    }]
  });
  rules.push({
    test: /\.m?js$/,
    include: /node_modules\/(@codemirror|codemirror)/,
    use: [{
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-env']
      }
    }]
  });
  rules.push({
    test: /\.m?js$/,
    include: /node_modules\/(@codemirror|codemirror)/,
    use: [{
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-env']
      }
    }]
  });
  const main = {
    mode,
    entry: {
      main: './src/main.js',
      console: './src/lib/console.js',
      searchInFilesWorker: './src/sidebarApps/searchInFiles/worker.js',
      searchIndexWorker: './src/sidebarApps/searchInFiles/indexWorker.js'
    },
    output: {
      path: path.resolve(__dirname, 'www/build/'),
      filename: '[name].js',
      chunkFilename: '[name].chunk.js',
      assetModuleFilename: '[name][ext]',
      publicPath: '/build/',
      clean: true
    },
    module: {
      rules
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
      fallback: {
        path: require.resolve('path-browserify'),
        crypto: false
      },
      modules: ["node_modules", "src"]
    },
    plugins: [new MiniCssExtractPlugin({
      filename: '[name].css'
    })]
  };
  return [main];
};
