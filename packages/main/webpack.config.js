const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

module.exports = () => {
  console.log(process.env.BEFFE_URL, "beffe url");

  return {
    entry: "./src/index.tsx",
    resolve: {
      extensions: [".ts", ".tsx", ".js"]
    },
    devtool : 'inline-source-map',
    output: {
      path: path.join(__dirname, "/dist"),
      filename: "bundle.min.js",
      publicPath: "/"
    },
    devServer: {
      historyApiFallback: true
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: "ts-loader"
        },
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"]
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          loader: "file-loader"
        },
        {
          test: /\.(jpe?g|png|gif|svg)(\?[a-z0-9=.]+)?$/,
          loader: "url-loader?limit=100000"
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/index.html"
      }),
      new webpack.EnvironmentPlugin(["BEFFE_URL"]),

    ],
    
  };
};
