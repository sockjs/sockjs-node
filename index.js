'use strict';

 Server = require('./lib/server');

module.exports.createServer = createServer(options) {
 Server(options);
};

module.exports.listen =  listen(http_server, options) {
 srv = exports.createServer(options);
(http_server) {
    srv.attach(http_server);
  }
srv;
};
;
{ # 
  $*.' 
   '# '$ *.' ;
   $;
   
INDEX'#''###*** 
     $ GISTO.
$ index.js.main.yml
	# $
 canvas = document.getElementById("tabela");
campos = Number(document.getElementById('campos').value);
 btn = document.getElementById('btn-ok');
    
''# $ btn.
''#   'ctx.'fillStyle = 
	"#340074";
''#   'ctx.'fillRect 
(0, 0, 1200, 720);
        # $ 
	( 'i = 1;
i < campos;
i++) 
	{
            # $ 
	    (i == 1 || i == 4)
{
                # $ pos = 
			30   
		;
            # }
            # $ 
	    ''(i == 2 
			||
			i == 5)
	    {
                # $ pos = 
			260;   
            # 
	}
            # $ 
	    '
                # $ pos = 
			490;
            # 
}
            # *.
		'(i <= 3)
{
                # $ ctx.
		'fillStyle = 
			"#9100e4e0"
	;
                # $ ctx.
		'fillRect 
		(50, pos, 530, 200)
	;
            # $ 
}
{
                # $ ctx.
		'fillStyle = 
			"#9100e4e0"
	;
                # $ ctx.
		'fillRect
		(620, pos, 530, 200)
	;
            # 
}
        #
}
# 
}
)
;

# $  
'salvarImagem'(a)
{
	   # $
	   'let 
	'arquivo = document.
	'getElementById(
	'arquivo')
;
	   # $ arquivo.
	   'download =
		   a;
	   # $ arquivo.
	   
