desc "Builds the JS files"
task :build do
  files = [
    "packages/indexeddb-adapter/lib/indexeddb_migration.js",
    "packages/indexeddb-adapter/lib/indexeddb_serializer.js",
    "packages/indexeddb-adapter/lib/indexeddb_smartsearch.js",
    "packages/indexeddb-adapter/lib/indexeddb_adapter.js"
  ]

  code = files.map { |file| File.open(file).read }

  FileUtils.mkdir_p("dist")
  file = File.new("dist/ember_indexeddb_adapter.js", "w+")
  file.write(code.join("\n"))
  file.close

  puts "Build complete."
end
