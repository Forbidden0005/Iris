class CrewCli < Formula
  desc "Command-line interface for iris agent orchestration"
  homepage "https://iris.ai"
  url "https://registry.npmjs.org/@iris/iris-cli/-/iris-cli-0.1.0.tgz"
  sha256 "REPLACE_WITH_SHA256"
  license "MIT"

  depends_on "node" >= "20.0.0"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/iris", "--version"
  end
end
